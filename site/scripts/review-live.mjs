// Visual review sweep of SITE_URL: screenshots + layout sanity checks
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
const OUT = path.resolve(process.env.SHOT_DIR ?? 'scripts/review-shots');
fs.mkdirSync(OUT, { recursive: true });

// Resolve a live anime path from the homepage — the dataset evolves and the old
// hardcoded slug (/anime/clevatess/) is gone. ANIME_PATH overrides if set.
let animeUrl = process.env.ANIME_PATH ?? null;
if (!animeUrl) {
  try {
    const home = await (await fetch(BASE + '/')).text();
    const m = home.match(/\/anime\/[a-z0-9-]+\//);
    animeUrl = m ? m[0] : null;
  } catch (e) {
    console.error('could not resolve a live anime path from the homepage:', e.message);
    animeUrl = null;
  }
}

const pages = [
  { name: 'home', url: '/' },
  ...(animeUrl ? [{ name: 'anime', url: animeUrl }] : []),
  { name: 'list', url: '/list/' },
  { name: 'series', url: '/series/' },
  { name: 'schedule', url: '/schedule/' },
  { name: 'advanced-search', url: '/advanced-search/' },
  { name: 'about', url: '/about/' },
];

const browser = await chromium.launch();
for (const vp of [{ tag: 'desktop', width: 1440, height: 900 }, { tag: 'mobile', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const p of pages) {
    try {
      await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(800);
      // horizontal overflow check
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
      });
      const hasOverflow = overflow.scrollW > overflow.clientW + 2;
      // broken images check
      const brokenImgs = await page.evaluate(() =>
        [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && !i.src.includes('placeholder')).map(i => i.src.slice(-60))
      );
      await page.screenshot({ path: `${OUT}/${p.name}-${vp.tag}.png`, fullPage: false });
      console.log(`${vp.tag}/${p.name}: shot ok | hOverflow=${hasOverflow} (${overflow.scrollW}vs${overflow.clientW}) | brokenImgs=${brokenImgs.length}${brokenImgs.length ? ' :: ' + brokenImgs.slice(0,3).join(' , ') : ''}`);
    } catch (e) {
      console.log(`${vp.tag}/${p.name}: ERROR ${e.message.split('\n')[0]}`);
    }
  }
  // mobile burger menu open state
  if (vp.tag === 'mobile') {
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
      const btn = page.locator('button').first();
      await btn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/home-mobile-menu.png` });
      console.log('mobile/menu: shot ok');
    } catch (e) { console.log('mobile/menu: ERROR ' + e.message.split('\n')[0]); }
  }
  await page.close();
}
await browser.close();
console.log('DONE');
