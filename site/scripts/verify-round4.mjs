// Round-4 functional proof in a real browser:
//  1. per-page CSP sha256 hashes must NOT break hydration (inline scripts run),
//  2. the immutable content-hashed search index must fetch and filter,
//  3. interactive components (menu toggle) must work after hydration.
// Any CSP violation surfaces as a console error ("Refused to execute inline
// script...") and fails this script. Run AFTER `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const pwSpec = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const pwUrl = path.isAbsolute(pwSpec) ? pathToFileURL(path.join(pwSpec, 'index.mjs')).href : pwSpec;
let chromium;
try {
  ({ chromium } = await import(pwUrl));
} catch {
  console.error(`Missing browser driver: cannot resolve '${pwSpec}' (see verify-render.mjs header for options).`);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 4174);
const OUT = path.resolve(process.env.OUT_DIR ?? 'out');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};
const server = http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    const file = path.resolve(OUT, '.' + (p.endsWith('/') ? p + 'index.html' : p));
    const rel = path.relative(OUT, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  })
  .listen(PORT, '127.0.0.1');

const base = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});

const results = {};
try {
  // 1. /search?q=... — results render ONLY if the inline hydration scripts
  //    executed (CSP hashes correct) and the index fetch succeeded.
  await page.goto(`${base}/search/?q=youjo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('a[href^="/anime/"]', { timeout: 15000 });
  results.searchLinks = await page.locator('a[href^="/anime/"]').count();
  results.searchIndexFetch = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/search-index/'))
      .map((e) => ({ file: e.name.split('/').pop(), bytes: e.transferSize }))
  );
  const firstAnime = await page.locator('a[href^="/anime/"]').first().getAttribute('href');

  // 2. /advanced-search — the results counter appears only after index load.
  await page.goto(`${base}/advanced-search/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('النتائج:'), { timeout: 15000 });
  results.advancedCount = await page.evaluate(() => (document.body.innerText.match(/النتائج: \d+/) || [''])[0]);

  // 3. Home — hydration proof: clicking the header menu button mutates the DOM.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const before = await page.evaluate(() => document.body.innerHTML.length);
  const btn = page.locator('header button, nav button').first();
  results.homeButtonFound = (await btn.count()) > 0;
  if (results.homeButtonFound) {
    await btn.click();
    await page.waitForTimeout(600);
  }
  const after = await page.evaluate(() => document.body.innerHTML.length);
  results.homeDomChanged = before !== after;

  // 4. An anime page renders its episode list.
  await page.goto(`${base}${firstAnime}`, { waitUntil: 'networkidle' });
  results.animeTitle = await page.title();
  results.animeHasEpisodes = await page.evaluate(() => document.body.innerText.includes('الحلقة'));

  // 5. The served page carries the hash-based meta CSP (no unsafe-inline).
  results.cspMeta = await page.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    // Count only properly single-quoted hash sources (bare ones are invalid).
    return m ? { present: true, unsafeInline: m.content.includes('unsafe-inline'), hashes: (m.content.match(/'sha256-[A-Za-z0-9+/=]+'/g) || []).length } : { present: false };
  });
} catch (e) {
  problems.push(`check failed: ${e.message}`);
}

await browser.close();
server.close();

const ok =
  problems.length === 0 &&
  results.searchLinks > 0 &&
  results.searchIndexFetch?.length > 0 &&
  /النتائج: [1-9]/.test(results.advancedCount ?? '') &&
  results.homeDomChanged === true &&
  results.animeHasEpisodes === true &&
  results.cspMeta?.present === true &&
  results.cspMeta?.unsafeInline === false;

console.log(JSON.stringify({ ok, results, problems }, null, 2));
process.exit(ok ? 0 : 1);
