import fs from 'node:fs';
import path from 'node:path';
import { ensureSession } from './login.mjs';
import { fetchPage } from './http.mjs';
import { BASE, DATA, photonToOrigin } from './util.mjs';
import * as cheerio from 'cheerio';

await ensureSession();
const { status, html } = await fetchPage(`${BASE}/`);
if (status !== 200 || !html) {
  console.error('home fetch failed', status);
  process.exit(1);
}
const $ = cheerio.load(html);

const banners = [];
$('a[href] img').each((_, img) => {
  const $a = $(img).closest('a');
  const src = photonToOrigin($(img).attr('src') ?? '');
  const href = $a.attr('href') ?? '';
  const alt = ($(img).attr('alt') ?? '').trim();
  const ctx = $a.closest('div,section').text().replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!src.includes('wp-content/uploads')) return;
  if (/logo|favicon|avatar|icons8/i.test(src)) return;
  banners.push({ src, href, alt, ctx });
});

const seen = new Set();
const unique = banners.filter((b) => (seen.has(b.src) ? false : (seen.add(b.src), true)));
for (const b of unique) console.log(JSON.stringify(b));

fs.writeFileSync(path.join(DATA, 'pages', '_banners_raw.json'), JSON.stringify(unique, null, 2));
console.log('total:', unique.length);
