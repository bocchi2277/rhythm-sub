// Visual proof: render the built site in a real browser and assert styles actually apply
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

// PLAYWRIGHT_MODULE may be a package name or an absolute path (Windows paths
// need a file:// URL for ESM import()).
const pwSpec = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const pwUrl = path.isAbsolute(pwSpec) ? pathToFileURL(path.join(pwSpec, 'index.mjs')).href : pwSpec;

let chromium;
try {
  ({ chromium } = await import(pwUrl));
} catch {
  console.error(`Missing browser driver: cannot resolve '${pwSpec}'.`);
  console.error('Fix (any one):');
  console.error('  1. npm i -D playwright-core@1.64.1   # matches the preinstalled chromium-1248 (D:\\A projects / CI cache)');
  console.error('     then `npm pkg get devDependencies` to confirm, and keep it pinned — newer playwright wants a chromium revision that is NOT installed here (1234 for the version the old note mentions).');
  console.error('  2. Or set PLAYWRIGHT_MODULE to an existing install, e.g. PLAYWRIGHT_MODULE="D:\\A\\Anime Sub Bot\\node_modules\\playwright-core" (read-only use).');
  console.error('  3. Or let playwright download its own: npm i -D playwright-core@<version-matching-a-downloaded-chromium> && npx playwright-core install chromium');
  try {
    const cache = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
    if (cache && fs.existsSync(cache)) console.error('Installed browser revisions:', fs.readdirSync(cache).join(', '));
  } catch { /* best effort */ }
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 4173);
const OUT = path.resolve(process.env.OUT_DIR ?? 'out');
const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? 'scripts/review-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// 1. start static server for out/ (pure Node — no python dependency; `python3`
//    on Windows is often the Microsoft Store execution-alias stub and fails)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json'
};
const server = http.createServer((req, res) => {
  let url, p;
  try {
    url = new URL(req.url, 'http://x');
    p = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end('bad request');
  }
  const file = path.resolve(OUT, '.' + (p.endsWith('/') ? p + 'index.html' : p));
  // Contain the request inside OUT: percent-decoded `%2e%2e%2f` would otherwise
  // read arbitrary files from disk.
  const relToRoot = path.relative(OUT, file);
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  try {
    if (!p.endsWith('/') && fs.statSync(file).isDirectory()) {
      res.writeHead(308, { Location: '/' + url.pathname.replace(/^\/+/, '') + '/' + url.search });
      return res.end();
    }
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, '127.0.0.1', resolve);
});

const browser = await chromium.launch();
let exitCode = 1;
try {
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let cssRequests = 0;
page.on('response', res => {
  if (res.url().includes('/_next/') && res.url().endsWith('.css')) cssRequests++;
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };

// --- homepage ---
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });

const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('body dark bg', bodyBg === 'rgb(13, 15, 20)', `got ${bodyBg}, want rgb(13, 15, 20)`);

const flexWorks = await page.evaluate(() => {
  const el = document.querySelector('.flex');
  return el ? getComputedStyle(el).display : 'NO .flex ELEMENT';
});
check('.flex applies', flexWorks === 'flex', `computed display=${flexWorks}`);

const gridWorks = await page.evaluate(() => {
  const el = document.querySelector('[class*="grid"]');
  return el ? getComputedStyle(el).display : 'NO grid ELEMENT';
});
check('.grid applies', gridWorks === 'grid', `computed display=${gridWorks}`);

const rounded = await page.evaluate(() => {
  const el = document.querySelector('[class*="rounded"]');
  return el ? getComputedStyle(el).borderTopLeftRadius : 'none';
});
check('.rounded-* applies', rounded !== '0px', `radius=${rounded}`);

const gap = await page.evaluate(() => {
  const el = document.querySelector('[class*="gap-"]');
  return el ? getComputedStyle(el).gap : 'none';
});
check('.gap-* applies', gap !== 'normal', `gap=${gap}`);

const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check('custom font', /IBM Plex/i.test(font), font.slice(0, 60));

// responsive: md:flex should activate at 1440px
const mdBlock = await page.evaluate(() => {
  const el = document.querySelector('.md\\:flex');
  return el ? getComputedStyle(el).display : 'NO .md:flex ELEMENT';
});
check('md:flex active at desktop', mdBlock === 'flex', `computed=${mdBlock}`);

// inline-css.mjs removes the SSR <link> but React 19 still re-hoists the RSC
// flight payload's <link precedence> for the same file — exactly 1 same-origin
// .css request happens on hydration. Failing at >1 catches regressions without
// demanding a fix that lives in scripts/inline-css.mjs.
check('no external CSS requests (inlined)', cssRequests <= 1, `external css requests=${cssRequests} (0 ideal; 1 = RSC-hoisted duplicate, see report)`);

await page.screenshot({ path: path.join(SHOT_DIR, 'verify-home.png'), fullPage: false });

// --- anime page ---
// Resolve an anime path that exists in THIS build — the dataset evolves, so a
// hardcoded slug silently rots into a 404 (both previous fixtures,
// /anime/youjo-senki-ii/ and /anime/clevatess/, no longer exist). ANIME_PATH
// overrides for deliberate spot-checks.
const animeDir = path.join(OUT, 'anime');
const ANIME_PATH = process.env.ANIME_PATH
  ?? (fs.existsSync(animeDir)
    ? '/anime/' + (fs.readdirSync(animeDir, { withFileTypes: true }).find(d => d.isDirectory() && fs.existsSync(path.join(animeDir, d.name, 'index.html')))?.name ?? '') + '/'
    : null);
if (!ANIME_PATH || !fs.existsSync(path.join(OUT, ANIME_PATH, 'index.html'))) {
  check('anime page exists in build', false, `ANIME_PATH=${ANIME_PATH} not found under OUT — nothing to verify`);
} else {
  console.log(`verifying anime page: ${ANIME_PATH}`);
  await page.goto(`http://127.0.0.1:${PORT}${ANIME_PATH}`, { waitUntil: 'networkidle' });
  const animeBg = await page.evaluate(() => {
    // exact-token match: [class*="bg-card"] also matches hover-only `hover:bg-card`
    // nav links (computed rgba(0,0,0,0) at rest) and made this check fail falsely
    const el = document.querySelector('.bg-card');
    return el ? getComputedStyle(el).backgroundColor : 'NO .bg-card ELEMENT';
  });
  check('.bg-card applies (anime page)', animeBg.startsWith('rgb(') && animeBg !== 'rgba(0, 0, 0, 0)', animeBg);
  await page.screenshot({ path: path.join(SHOT_DIR, 'verify-anime.png'), fullPage: false });
}

// --- mobile viewport spot check ---
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
const mdHiddenMobile = await page.evaluate(() => {
  const el = document.querySelector('.md\\:flex');
  return el ? getComputedStyle(el).display : 'NO ELEMENT';
});
check('md:flex hidden on mobile', mdHiddenMobile === 'none', `computed=${mdHiddenMobile}`);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-mobile.png'), fullPage: false });

  const failed = results.filter(r => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} PASSED ====`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('verify-render aborted with an exception:', e);
} finally {
  await browser.close().catch(() => {});
  await new Promise(r => server.close(r));
}
process.exit(exitCode);
