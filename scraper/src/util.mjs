import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  let segment = '';
  try {
    segment = new URL(url).pathname.replace(/\/+$/, '').split('/').pop() || '';
  } catch {
    segment = String(url ?? '');
  }
  // Keep only safe filename chars. Upstream URLs are expected to be clean, but
  // the value becomes a local filename (scrape/sync write `<slug>.json`), so
  // reject traversal/separator tricks and never return dot-only segments.
  const safe = segment.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!safe || safe === '.' || safe === '..') {
    const hash = crypto.createHash('sha1').update(String(url ?? '')).digest('hex').slice(0, 16);
    return `post-${hash}`;
  }
  return safe;
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

// Write via a temp file in the same directory, then rename over the target.
// A crash mid-write can then never leave a truncated JSON/model file behind.
export function writeFileAtomic(file, content) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
  } finally {
    // No-op after a successful rename; removes the temp file if writing or
    // renaming failed.
    try {
      fs.rmSync(tmp, { force: true });
    } catch {}
  }
}

export function writeJsonAtomic(file, value, space = 2) {
  writeFileAtomic(file, JSON.stringify(value, null, space));
}

// SSRF guard: only fetch from the known upstream hosts. A substring check
// (url.includes('rhythm-sub.com')) can be bypassed via
// https://evil.example/?rhythm-sub.com/wp-content — parse the hostname instead.
// Exact hosts only — no wildcard. `*.wp.com` would admit ANY subdomain
// (evil.wp.com included); Photon only ever serves from i0-i2.
const ALLOWED_IMG_HOSTS = new Set([
  'rhythm-sub.com',
  'www.rhythm-sub.com',
  'i0.wp.com',
  'i1.wp.com',
  'i2.wp.com'
]);
export function isAllowedImageHost(url) {
  try {
    return ALLOWED_IMG_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Fetch an image with SSRF-hardened redirect handling.
//
// `fetch` follows redirects by default, so an allowlisted URL that 30xes to
// http://169.254.169.254/... would otherwise be fetched without a second
// thought. Here every hop is re-validated against the allowlist, and a
// non-image content-type (e.g. an HTML block page) is refused.
export async function fetchAllowedImage(url, { referer, ua = UA, timeoutMs = 60000, maxRedirects = 5 } = {}) {
  let current = String(url);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isAllowedImageHost(current)) throw new Error(`host not allowed: ${current}`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        headers: { 'User-Agent': ua, ...(referer ? { Referer: referer } : {}) },
        redirect: 'manual',
        signal: ctrl.signal
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).href;
        await res.arrayBuffer().catch(() => {});
        continue;
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (ct && !ct.startsWith('image/')) throw new Error(`not an image (content-type ${ct})`);
      return res;
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(`too many redirects (>${maxRedirects})`);
}

// Percent-decoding happens AFTER the URL parser has normalized literal `..`,
// so `%2e%2e%2f` / `%5c` survive and path.join would walk out of the base dir.
// Strip dot segments and separators, then verify containment with safeJoin.
export function safeRel(u) {
  const decoded = decodeURIComponent(u.pathname).replace(/^\//, '').replace(/[:*?"<>|\\]/g, '_');
  return decoded.split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
}

export function safeJoin(base, rel) {
  const resolved = path.resolve(base, rel);
  const relToBase = path.relative(base, resolved);
  if (relToBase.startsWith('..') || path.isAbsolute(relToBase)) {
    throw new Error(`Refusing path outside ${base}: ${rel}`);
  }
  return resolved;
}

// Read a fetch response body with a hard byte cap BEFORE buffering it all:
// honor content-length when present, but also bound the actual streamed bytes
// so a missing/lying content-length cannot exhaust memory.
export async function readBodyLimited(res, maxBytes) {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    if (res.body) await res.body.cancel().catch(() => {});
    throw new Error(`content-length ${declared}B exceeds cap ${maxBytes}B`);
  }
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error(`body ${buf.length}B exceeds cap ${maxBytes}B`);
    return buf;
  }
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`body exceeds cap ${maxBytes}B`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
