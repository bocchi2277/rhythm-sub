import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = path.join(ROOT, 'data');
export const POSTS_DIR = path.join(DATA, 'posts');
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export const BASE = 'https://rhythm-sub.com';

export function loadEnv() {
  const envFile = path.join(ROOT, 'scraper', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export function ensureDirs() {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
}

export function slugFromUrl(url) {
  return new URL(url).pathname.replace(/\/+$/, '').split('/').pop();
}

export function photonToOrigin(u) {
  if (!u) return u;
  try {
    const url = new URL(u, BASE);
    if (/^i\d\.wp\.com$/.test(url.hostname)) {
      return `https://${url.pathname.slice(1)}`;
    }
    return url.origin + url.pathname;
  } catch {
    return u;
  }
}
