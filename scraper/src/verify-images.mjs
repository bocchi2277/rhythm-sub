import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA } from './util.mjs';

const IMG_DIR = path.join(DATA, 'images');
const MAP_FILE = path.join(DATA, 'image_map.json');

const series = JSON.parse(fs.readFileSync(path.join(DATA, 'series.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

const urls = new Set();
for (const s of series) {
  if (s.cover?.includes('rhythm-sub.com')) urls.add(s.cover);
  for (const e of s.episodes) {
    for (const im of e.contentImages ?? []) if (im.includes('rhythm-sub.com')) urls.add(im);
  }
}

function expectedRel(url) {
  if (map[url]) return map[url];
  return decodeURIComponent(new URL(url).pathname).replace(/^\//, '').replace(/[:*?"<>|]/g, '_');
}

let ok = 0;
const missing = [];
for (const url of urls) {
  const p = path.join(IMG_DIR, expectedRel(url));
  try {
    if (fs.statSync(p).size > 500) ok++;
    else missing.push(url);
  } catch {
    missing.push(url);
  }
}

let diskFiles = 0;
let diskBytes = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else {
      diskFiles++;
      diskBytes += f.size ?? fs.statSync(full).size;
    }
  }
})(IMG_DIR);

console.log(`unique URLs: ${urls.size} | verified present: ${ok} | missing: ${missing.length}`);
console.log(`on disk: ${diskFiles} files | ${(diskBytes / 1048576).toFixed(1)}MB`);
if (missing.length) console.log('missing samples:', missing.slice(0, 5));

const orphans = [];
(function walk2(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk2(full);
    else {
      const rel = path.relative(IMG_DIR, full).replace(/\\/g, '/');
      if (!urlsHas(rel)) orphans.push(rel);
    }
  }
  function urlsHas(rel) {
    for (const u of urls) {
      if (expectedRel(u) === rel) return true;
      const enc = encodeURI(rel);
      if (`wp-content/${rel}` === new URL(u).pathname.replace(/^\//, '')) return true;
    }
    return false;
  }
})(IMG_DIR);
console.log(`orphan files not referenced: ${orphans.length}`);
