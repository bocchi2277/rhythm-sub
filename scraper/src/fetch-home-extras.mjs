import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureSession } from './login.mjs';
import { fetchPage } from './http.mjs';
import { BASE, DATA } from './util.mjs';
import * as cheerio from 'cheerio';

// Exact-host allowlist: the old substring test on the href let
// 'https://evil.example/?t.me' qualify as an "official channel" — stored
// phishing if the upstream homepage is ever compromised. Parse the URL and
// require https + an exact social host instead. Pure + exported for tests.
const SOCIAL_HOSTS = new Set([
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  't.me', 'telegram.me', 'discord.gg', 'discord.com', 'www.discord.com',
  'youtube.com', 'www.youtube.com', 'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com'
]);

export function isSocialUrl(href) {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && SOCIAL_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function main() {
  await ensureSession();
  const { status, html } = await fetchPage(`${BASE}/`);
  if (status !== 200 || !html) {
    console.error('home fetch failed', status);
    process.exit(1);
  }
  const $ = cheerio.load(html);

  let projectsSection = null;
  $('h2, h3').each((_, h) => {
    const t = $(h).text().replace(/\s+/g, ' ').trim();
    if (/مشاريعنا|المشاريع الحالية|أعمالنا الحالية/.test(t)) {
      projectsSection = { title: t, el: $(h) };
    }
  });

  const projectLinks = [];
  if (projectsSection) {
    console.log('section found:', projectsSection.title);
    let $sec = projectsSection.el.parent();
    for (let i = 0; i < 4 && $sec.find('a[href*="/20"]').length === 0; i++) $sec = $sec.parent();
    $sec.find('a[href*="/20"]').each((_, a) => {
      const href = ($(a).attr('href') ?? '').split('#')[0].replace(/\/+$/, '');
      if (/rhythm-sub\.com\/20\d{2}\//.test(href)) projectLinks.push(href);
    });
  } else {
    console.log('projects section NOT found by heading');
  }
  console.log('project links:', [...new Set(projectLinks)].length);

  const socials = [];
  const seen = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (isSocialUrl(href) && !seen.has(href)) {
      seen.add(href);
      socials.push({ href, label: ($(a).attr('aria-label') || $(a).text() || '').trim().slice(0, 40) });
    }
  });
  console.log('socials:', JSON.stringify(socials, null, 1));

  fs.writeFileSync(
    path.join(DATA, 'pages', '_home_extras.json'),
    JSON.stringify({ projectPostUrls: [...new Set(projectLinks)], socials }, null, 2)
  );
  console.log('saved _home_extras.json');
}

// CLI direct run — importing this module must not log in and fetch as a side
// effect (same guarded-entry convention as login.mjs / sync.mjs).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
