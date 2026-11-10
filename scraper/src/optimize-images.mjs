import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DATA, isAllowedImageHost, safeRel, safeJoin, writeJsonAtomic, writeFileAtomic } from './util.mjs';

const IMG_DIR = path.join(DATA, 'images');
const OUT_DIR = path.resolve(DATA, '../site/public/img');
const MANIFEST = path.resolve(DATA, '../site/img-manifest.json');
const CONCURRENCY = 6;

const series = JSON.parse(fs.readFileSync(path.join(DATA, 'series.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(DATA, 'image_map.json'), 'utf8'));

const urls = new Set();
for (const s of series) {
  if (s.cover && isAllowedImageHost(s.cover)) urls.add(s.cover);
  for (const e of s.episodes) {
    // Collect episode contentImages independently of the cover: an episode
    // with a missing/external cover still has inline images worth optimizing.
    if (e.cover && isAllowedImageHost(e.cover)) urls.add(e.cover);
    for (const im of e.contentImages ?? []) if (isAllowedImageHost(im)) urls.add(im);
  }
}
// Static pages (about/support/etc.) carry images too — same source dir as
// download-images.mjs uses.
const pagesDir = path.join(DATA, 'pages');
if (fs.existsSync(pagesDir)) {
  for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const p = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
    for (const im of p.images ?? []) if (isAllowedImageHost(im)) urls.add(im);
  }
}

let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch {}

function srcPath(url) {
  const u = new URL(url);
  if (map[url]) return safeJoin(IMG_DIR, map[url]);
  const rel = safeRel(u);
  if (!rel) throw new Error(`Empty image path for ${u.href}`);
  return safeJoin(IMG_DIR, rel);
}

function outName(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.webp';
}

// Manifest values are site-rooted (/img/<hash>.webp) while OUT_DIR already
// ends in img — strip the prefix before joining, or the existence check looks
// in img/img/ and every image is re-optimized on every run.
const queue = [...urls].filter((u) => !manifest[u] || !fs.existsSync(path.join(OUT_DIR, manifest[u].replace(/^\/img\//, ''))));
console.log(`total ${urls.size} | optimized ${urls.size - queue.length} | todo ${queue.length}`);

let done = 0;
let failed = [];
let bytesIn = 0;
let bytesOut = 0;
const startedAt = Date.now();

async function optimize(url) {
  try {
    const src = srcPath(url);
    const isCover = /\/l\.(jpg|jpeg|png|webp)$/i.test(src) || /mal-logo|logo/i.test(src);
    const img = sharp(src, { failOn: 'none' });
    const meta = await img.metadata();
    let pipe = img.rotate().webp({ quality: 78, effort: 3 });
    if ((meta.width ?? 0) > 1400 && !isCover) pipe = sharp(src, { failOn: 'none' }).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 78, effort: 3 });
    else if ((meta.width ?? 0) > 900) pipe = sharp(src, { failOn: 'none' }).rotate().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78, effort: 3 });
    const buf = await pipe.toBuffer();
    writeFileAtomic(path.join(OUT_DIR, outName(url)), buf);
    bytesIn += fs.statSync(src).size;
    bytesOut += buf.length;
    manifest[url] = `/img/${outName(url)}`;
  } catch (e) {
    failed.push({ url, error: String(e.message ?? e) });
  }
  done++;
  if (done % 200 === 0) console.log(`${done}/${queue.length} (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`);
}

async function worker(q) {
  while (q.length) await optimize(q.shift());
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const q = [...queue];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(q)));

writeJsonAtomic(MANIFEST, manifest);
writeJsonAtomic(path.join(DATA, 'optimize_failures.json'), failed);
console.log(`DONE ok=${done - failed.length} failed=${failed.length} | ${(bytesIn / 1048576).toFixed(0)}MB -> ${(bytesOut / 1048576).toFixed(0)}MB`);
