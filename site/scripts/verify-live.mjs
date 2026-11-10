// Final production verification against SITE_URL (default: https://rhythm-sub.pages.dev)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// PLAYWRIGHT_MODULE may be a package name or an absolute path (Windows absolute
// paths need a file:// URL for ESM import()).
const pwSpec = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const pwUrl = path.isAbsolute(pwSpec) ? pathToFileURL(path.join(pwSpec, 'index.mjs')).href : pwSpec;

let chromium;
try {
  ({ chromium } = await import(pwUrl));
} catch {
  console.error(`Missing browser driver: cannot resolve '${pwSpec}'.`);
  console.error('Fix: npm i -D playwright-core@1.64.1 (matches preinstalled chromium-1248), or set PLAYWRIGHT_MODULE to an existing install, or `npx playwright-core install chromium`.');
  try {
    const cache = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
    if (fs.existsSync(cache)) console.error('Installed browser revisions:', fs.readdirSync(cache).join(', '));
  } catch { /* best effort */ }
  process.exit(1);
}

const BASE = process.env.SITE_URL ?? 'https://rhythm-sub.pages.dev';
const SHOT_DIR = path.resolve(process.env.SHOT_DIR ?? 'scripts/review-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// --- homepage ---
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });

const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('LIVE body dark bg', bodyBg === 'rgb(13, 15, 20)', bodyBg);

const flexWorks = await page.evaluate(() => {
  const el = document.querySelector('.flex');
  return el ? getComputedStyle(el).display : 'NO .flex ELEMENT';
});
check('LIVE .flex applies', flexWorks === 'flex', flexWorks);

const gridWorks = await page.evaluate(() => {
  const el = document.querySelector('[class*="grid-cols"]');
  return el ? getComputedStyle(el).display : 'NO grid ELEMENT';
});
check('LIVE .grid applies', gridWorks === 'grid', gridWorks);

// class coverage against the LIVE inline <style>
const coverage = await page.evaluate(() => {
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const cssClasses = new Set();
  const re = /\.((?:[a-zA-Z0-9_\-]|\\.)+)/g;
  let m;
  while ((m = re.exec(css))) cssClasses.add(m[1].replace(/\\/g, ''));
  const used = new Set();
  for (const el of document.querySelectorAll('[class]'))
    for (const c of el.classList) used.add(c);
  const missing = [...used].filter(c => !cssClasses.has(c));
  return { used: used.size, missing };
});
check('LIVE class coverage', coverage.missing.length === 0,
  `${coverage.used} used, missing=${coverage.missing.length} ${coverage.missing.slice(0, 8).join(',')}`);

const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
check('LIVE custom font', /IBM Plex/i.test(font), font.slice(0, 50));

await page.screenshot({ path: path.join(SHOT_DIR, 'live-home.png'), fullPage: false });

// --- anime page ---
// Resolve an anime path from the LIVE homepage instead of a hardcoded slug —
// the dataset evolves and previous fixtures (/anime/youjo-senki-ii/) are gone.
const animePath = process.env.ANIME_PATH ?? await page.evaluate(() => {
  const href = [...document.querySelectorAll('a[href^="/anime/"]')]
    .map(a => a.getAttribute('href'))
    .find(h => /^\/anime\/[a-z0-9-]+\/?$/.test(h ?? ''));
  return href ? (href.endsWith('/') ? href : href + '/') : null;
});
if (!animePath) {
  check('LIVE anime path resolvable', false, 'no /anime/<slug>/ link found on the live homepage; set ANIME_PATH explicitly');
} else {
console.log(`verifying live anime page: ${animePath}`);
await page.goto(BASE + animePath, { waitUntil: 'networkidle', timeout: 60000 });
const animeCoverage = await page.evaluate(() => {
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const cssClasses = new Set();
  const re = /\.((?:[a-zA-Z0-9_\-]|\\.)+)/g;
  let m;
  while ((m = re.exec(css))) cssClasses.add(m[1].replace(/\\/g, ''));
  const used = new Set();
  for (const el of document.querySelectorAll('[class]'))
    for (const c of el.classList) used.add(c);
  return { used: used.size, missing: [...used].filter(c => !cssClasses.has(c)) };
});
check('LIVE anime coverage', animeCoverage.missing.length === 0,
  `${animeCoverage.used} used, missing=${animeCoverage.missing.length}`);
await page.screenshot({ path: path.join(SHOT_DIR, 'live-anime.png'), fullPage: false });
}

// --- mobile ---
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
await page.screenshot({ path: path.join(SHOT_DIR, 'live-mobile.png'), fullPage: false });

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} PASSED ====`);
process.exit(failed.length ? 1 : 0);
