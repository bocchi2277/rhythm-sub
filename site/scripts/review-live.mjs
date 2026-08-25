// Visual review sweep of the live site: screenshots + layout sanity checks
import { chromium } from 'file:///C:/Users/mohamed/pw-verify/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';

const BASE = 'https://rhythm-sub.pages.dev';
const OUT = 'D:/rhythm/site/scripts/review-shots';
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  { name: 'home', url: '/' },
  { name: 'anime', url: '/anime/clevatess/' },
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
