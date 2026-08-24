import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA } from './util.mjs';

const IMG_DIR = path.join(DATA, 'images');
const MAP_FILE = path.join(DATA, 'image_map.json');
const CONCURRENCY = 4;
const UA_IMG = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36';

function loadMap() {
  try {
    return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function collectUrls() {
  const series = JSON.parse(fs.readFileSync(path.join(DATA, 'series.json'), 'utf8'));
  const urls = new Set();
  for (const s of series) {
    if (s.cover?.includes('rhythm-sub.com/wp-content')) urls.add(s.cover);
    for (const e of s.episodes) {
      if (e.cover?.includes('rhythm-sub.com/wp-content')) urls.add(e.cover);
      for (const im of e.contentImages ?? []) {
        if (im.includes('rhythm-sub.com/wp-content')) urls.add(im);
      }
    }
  }
  return [...urls].sort();
}

function localPath(url, map) {
  const u = new URL(url);
  const decoded = decodeURIComponent(u.pathname).replace(/^\//, '').replace(/[:*?"<>|]/g, '_');
  let rel = decoded;
  if (path.join(IMG_DIR, rel).length > 200) {
    const ext = path.extname(decoded) || '.jpg';
    const base = path.basename(decoded, ext);
    const dir = path.dirname(decoded);
    rel = path
      .join(dir, `${base.slice(0, 30)}_${crypto.createHash('sha1').update(base).digest('hex').slice(0, 12)}${ext}`)
      .replace(/\\/g, '/');
    map[url] = rel;
  }
  return path.join(IMG_DIR, rel);
}

async function download(url, dest, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(url, { headers: { 'User-Agent': UA_IMG }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error(`too small (${buf.length}B)`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function main() {
  const map = loadMap();
  const urls = collectUrls();
  console.log(`images to ensure: ${urls.length}`);
  const pending = urls.filter((u) => {
    const p = localPath(u, map);
    try {
      return fs.statSync(p).size < 500;
    } catch {
      return true;
    }
  });
  console.log(`already downloaded: ${urls.length - pending.length} | remaining: ${pending.length}`);

  let done = 0;
  let failed = [];
  let bytes = 0;
  const startedAt = Date.now();

  async function worker(queue) {
    while (queue.length) {
      const url = queue.shift();
      const dest = localPath(url, map);
      try {
        bytes += await download(url, dest);
      } catch (e) {
        failed.push({ url, error: String(e.message ?? e) });
      }
      done++;
      if (done % 100 === 0) {
        const rate = ((Date.now() - startedAt) / 1000 / done).toFixed(2);
        console.log(`${done}/${pending.length} (${rate}s/img, ${(bytes / 1048576).toFixed(0)}MB)`);
      }
    }
  }

  const queue = [...pending];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
  fs.writeFileSync(path.join(DATA, 'image_failures.json'), JSON.stringify(failed, null, 2));
  console.log(`DONE ok=${done - failed.length} failed=${failed.length} total=${(bytes / 1048576).toFixed(1)}MB`);
}

main();
