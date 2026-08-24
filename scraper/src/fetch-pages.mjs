import fs from 'node:fs';
import path from 'node:path';
import { ensureSession } from './login.mjs';
import { fetchPage } from './http.mjs';
import { BASE, DATA, photonToOrigin } from './util.mjs';
import * as cheerio from 'cheerio';

const PAGES = [
  { key: 'about', url: `${BASE}/who-are-we/` },
  { key: 'support', url: `${BASE}/technical-support/` }
];

const OUT = path.join(DATA, 'pages');
fs.mkdirSync(OUT, { recursive: true });

await ensureSession();

function extract(key, url, html) {
  const $ = cheerio.load(html);
  const $content = $('.bixbox .page').first().length ? $('.bixbox .page').first() : $('.entry-content').first();
  const contentHtml = $content.html()?.trim() ?? '';
  const images = [...new Set($content.find('img[src]').map((_, im) => photonToOrigin($(im).attr('src'))).get())];

  const $footer = $('.footercopyright').first();
  const footerHtml = $footer.html()?.trim() ?? '';

  const socials = [];
  $('footer a[href], .footercopyright a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (/facebook|twitter|x\.com|telegram|t\.me|discord|youtube|instagram/i.test(href)) {
      socials.push({ name: ($(a).text() || href).trim(), url: href });
    }
  });

  const title = ($('h1').first().text() || $('title').first().text() || '').replace(/\s*–\s*Rhythm-Sub\s*$/, '').trim();

  return { key, url, title, contentHtml, images, footerHtml, socials };
}

const results = {};
for (const p of PAGES) {
  const { status, html } = await fetchPage(p.url);
  if (status !== 200 || !html) {
    console.error(`FAIL ${p.key}: HTTP ${status}`);
    process.exit(1);
  }
  const data = extract(p.key, p.url, html);
  results[p.key] = data;
  fs.writeFileSync(path.join(OUT, `${p.key}.json`), JSON.stringify(data, null, 2));
  console.log(`ok ${p.key}: "${data.title}" | html:${data.contentHtml.length}ch | imgs:${data.images.length} | socials:${data.socials.length}`);
}

fs.writeFileSync(path.join(OUT, '_footer.json'), JSON.stringify({ footerHtml: results.about.footerHtml, socials: results.about.socials }, null, 2));
console.log('footer saved');
