// Final production verification against https://rhythm-sub.pages.dev
import { chromium } from 'file:///C:/Users/mohamed/pw-verify/node_modules/playwright-core/index.mjs';

const BASE = 'https://rhythm-sub.pages.dev';
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

await page.screenshot({ path: 'D:/rhythm/site/scripts/live-home.png', fullPage: false });

// --- anime page ---
await page.goto(BASE + '/anime/youjo-senki-ii/', { waitUntil: 'networkidle', timeout: 60000 });
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
await page.screenshot({ path: 'D:/rhythm/site/scripts/live-anime.png', fullPage: false });

// --- mobile ---
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
await page.screenshot({ path: 'D:/rhythm/site/scripts/live-mobile.png', fullPage: false });

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} PASSED ====`);
process.exit(failed.length ? 1 : 0);
