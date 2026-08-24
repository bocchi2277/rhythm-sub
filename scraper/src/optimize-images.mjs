import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DATA } from './util.mjs';

const IMG_DIR = path.join(DATA, 'images');
const OUT_DIR = path.resolve(DATA, '../site/public/img');
const MANIFEST = path.resolve(DATA, '../site/public/img-manifest.json');
const CONCURRENCY = 6;

const series = JSON.parse(fs.readFileSync(path.join(DATA, 'series.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(DATA, 'image_map.json'), 'utf8'));

const urls = new Set();
for (const s of series) {
  if (s.cover?.includes('rhythm-sub.com')) urls.add(s.cover);
  for (const e of s.episodes) {
    if (!e.cover?.includes('rhythm-sub.com')) continue;
    urls.add(e.cover);
    for (const im of e.contentImages ?? []) if (im.includes('rhythm-sub.com')) urls.add(im);
  }
}

let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch {}

function srcPath(url) {
  const u = new URL(url);
  const dec = decodeURIComponent(u.pathname).replace(/^\//, '').replace(/[:*?"<>|]/g, '_');
  return path.join(IMG_DIR, map[url] ?? dec);
}

function outName(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.webp';
}

const queue = [...urls].filter((u) => !manifest[u] || !fs.existsSync(path.join(OUT_DIR, manifest[u])));
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
    fs.writeFileSync(path.join(OUT_DIR, outName(url)), buf);
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

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(DATA, 'optimize_failures.json'), JSON.stringify(failed, null, 2));
console.log(`DONE ok=${done - failed.length} failed=${failed.length} | ${(bytesIn / 1048576).toFixed(0)}MB -> ${(bytesOut / 1048576).toFixed(0)}MB`);
