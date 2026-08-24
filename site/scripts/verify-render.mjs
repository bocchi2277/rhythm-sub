// Visual proof: render the built site in a real browser and assert styles actually apply
import { chromium } from 'file:///C:/Users/mohamed/pw-verify/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 4173;
const OUT = 'D:/rhythm/site/out';

// 1. start static server for out/
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: OUT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const browser = await chromium.launch();
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

check('no external CSS requests (inlined)', cssRequests === 0, `external css requests=${cssRequests}`);

await page.screenshot({ path: 'D:/rhythm/site/scripts/verify-home.png', fullPage: false });

// --- anime page ---
await page.goto(`http://127.0.0.1:${PORT}/anime/youjo-senki-ii/`, { waitUntil: 'networkidle' });
const animeBg = await page.evaluate(() => {
  const el = document.querySelector('.bg-card, [class*="bg-card"]');
  return el ? getComputedStyle(el).backgroundColor : 'NO .bg-card ELEMENT';
});
check('.bg-card applies (anime page)', animeBg.startsWith('rgb(') && animeBg !== 'rgba(0, 0, 0, 0)', animeBg);
await page.screenshot({ path: 'D:/rhythm/site/scripts/verify-anime.png', fullPage: false });

// --- mobile viewport spot check ---
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
const mdHiddenMobile = await page.evaluate(() => {
  const el = document.querySelector('.md\\:flex');
  return el ? getComputedStyle(el).display : 'NO ELEMENT';
});
check('md:flex hidden on mobile', mdHiddenMobile === 'none', `computed=${mdHiddenMobile}`);
await page.screenshot({ path: 'D:/rhythm/site/scripts/verify-mobile.png', fullPage: false });

await browser.close();
server.kill();

const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} PASSED ====`);
process.exit(failed.length ? 1 : 0);
