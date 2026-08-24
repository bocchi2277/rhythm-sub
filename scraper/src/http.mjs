import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SESSION_FILE = path.join(ROOT, 'scraper', '.session.json');

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export const BASE = 'https://rhythm-sub.com';

export const jar = {
  map: new Map(),
  load() {
    if (fs.existsSync(SESSION_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      this.map = new Map(Object.entries(saved));
    }
    return this;
  },
  absorb(res) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const line of setCookies) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  },
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  },
  save() {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(this.map), null, 2));
  },
  has(prefix) {
    return [...this.map.keys()].some((k) => k.startsWith(prefix));
  }
};

export const sleepBetween = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchPage(url, { tries = 3, timeoutMs = 30000, depth = 0 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Cookie: jar.header(), Accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: ctrl.signal
      });
      clearTimeout(t);

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const loc = new URL(res.headers.get('location'), url).href;
        jar.absorb(res);
        await res.arrayBuffer().catch(() => {});
        if (/wp-login/.test(loc)) return { status: res.status, redirectedTo: loc, html: null };
        if (depth < 5) return fetchPage(loc, { tries, timeoutMs, depth: depth + 1 });
        return { status: res.status, redirectedTo: loc, html: null };
      }

      jar.absorb(res);
      const html = await res.text();
      return { status: res.status, html };
    } catch (e) {
      lastErr = e;
      await sleepBetween(1500 * (i + 1));
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

export async function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Cookie: jar.header(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/wp-login.php`
    },
    body,
    redirect: 'manual'
  });
  jar.absorb(res);
  await res.arrayBuffer().catch(() => {});
  return res;
}
