import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonAtomic } from './util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SESSION_FILE = path.join(ROOT, 'scraper', '.session.json');

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
export const BASE = 'https://rhythm-sub.com';

export const jar = {
  map: new Map(),
  load() {
    this.map = new Map();
    if (fs.existsSync(SESSION_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        // A corrupt (truncated / non-object) session file must not crash the
        // scraper: fall back to an empty jar and let the next login refill it.
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
          this.map = new Map(Object.entries(saved).filter(([, v]) => typeof v === 'string'));
        }
      } catch {
        this.map = new Map();
      }
    }
    // A cookie injected via RHYTHM_COOKIE (GitHub secret) takes precedence over
    // the cached session: it lets the scraper authenticate from IPs where
    // wp-login.php itself is blocked (CI runners), where a fresh login is
    // impossible. Format: "name=value; name2=value2".
    const injected = process.env.RHYTHM_COOKIE;
    if (injected) {
      for (const part of injected.split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0) {
          const k = part.slice(0, eq).trim();
          const v = part.slice(eq + 1).trim();
          if (k) this.map.set(k, v);
        }
      }
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
    writeJsonAtomic(SESSION_FILE, Object.fromEntries(this.map));
    // Best-effort: session cookies are sensitive. Restrictive perms help on POSIX;
    // on Windows this may be a no-op depending on filesystem/ACL semantics.
    try {
      fs.chmodSync(SESSION_FILE, 0o600);
    } catch {}
  },
  has(prefix) {
    return [...this.map.keys()].some((k) => k.startsWith(prefix));
  }
};

// True when authentication is delegated to an injected cookie rather than a
// live login. Callers must NOT attempt a forced login in that mode: wp-login.php
// may be unreachable from this IP, and the attempt would only turn a clear
// "cookie expired" into a confusing "login failed (HTTP 403)".
export const usingInjectedCookie = () => Boolean(process.env.RHYTHM_COOKIE);

export const sleepBetween = (ms) => new Promise((r) => setTimeout(r, ms));

// Bounded exponential backoff for transient failures. Honor Retry-After
// (delta-seconds or HTTP-date) when the server sends it, but cap it so a
// hostile/misconfigured value cannot stall a CI run for hours.
const MAX_BACKOFF_MS = 30000;
const MAX_RETRY_AFTER_MS = 60000;
export function retryDelayMs(headers, attempt) {
  const ra = headers?.get?.('retry-after');
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) {
      // Negative delta-seconds is invalid: fall through to exponential backoff
      // (do NOT let Date.parse reinterpret "-5" as a past HTTP-date).
      if (secs >= 0) return Math.min(MAX_RETRY_AFTER_MS, secs * 1000);
    } else {
      const date = Date.parse(ra);
      if (!Number.isNaN(date)) return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - Date.now()));
    }
  }
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
}

// Never send the WordPress session cookie to a different origin: a hostile
// (or compromised) redirect target would otherwise harvest it.
const ALLOWED_COOKIE_HOSTS = new Set(['rhythm-sub.com', 'www.rhythm-sub.com']);
const sameSiteHost = (u) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return ALLOWED_COOKIE_HOSTS.has(h) || h.endsWith('.rhythm-sub.com') ? h : null;
  } catch {
    return null;
  }
};
const cookieFor = (u) => (sameSiteHost(u) ? jar.header() : undefined);

export async function fetchPage(url, { tries = 3, timeoutMs = 30000, depth = 0 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' };
      const cookie = cookieFor(url);
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(url, {
        headers,
        redirect: 'manual',
        signal: ctrl.signal
      });

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const locUrl = new URL(res.headers.get('location'), url);
        if (locUrl.protocol !== 'http:' && locUrl.protocol !== 'https:') {
          return { status: res.status, redirectedTo: locUrl.href, html: null };
        }
        const loc = locUrl.href;
        if (sameSiteHost(url)) jar.absorb(res);
        await res.arrayBuffer().catch(() => {});
        if (/wp-login/.test(loc)) return { status: res.status, redirectedTo: loc, html: null };
        // Never follow a redirect off-site. The HTML we fetch is republished
        // verbatim into data/posts/*.json -> series.json -> the public site,
        // so an open redirect on the upstream (or a compromised host) would
        // both become an SSRF primitive (http://169.254.169.254/...) and
        // inject attacker-controlled markup into the published model.
        // fetchAllowedImage() applies the same rule for image downloads.
        if (!sameSiteHost(loc)) {
          return { status: res.status, redirectedTo: loc, html: null };
        }
        if (depth < 5) return fetchPage(loc, { tries, timeoutMs, depth: depth + 1 });
        return { status: res.status, redirectedTo: loc, html: null };
      }

      if (sameSiteHost(url)) jar.absorb(res);
      const html = await res.text();
      // Retry rate limits / server errors with bounded backoff instead of
      // treating them as a definitive answer (a 503 challenge page would
      // otherwise look like "no posts here" and truncate the crawl).
      if ((res.status === 429 || res.status >= 500) && i < tries - 1) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        await sleepBetween(retryDelayMs(res.headers, i));
        continue;
      }
      return { status: res.status, html };
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleepBetween(retryDelayMs(null, i));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr ?? new Error('fetch failed');
}

export async function postForm(url, params, { timeoutMs = 30000 } = {}) {
  const body = new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${BASE}/wp-login.php`
    };
    const cookie = cookieFor(url);
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: ctrl.signal
    });
    if (sameSiteHost(url)) jar.absorb(res);
    await res.arrayBuffer().catch(() => {});
    return res;
  } finally {
    clearTimeout(t);
  }
}
