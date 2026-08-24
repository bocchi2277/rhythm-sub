import fs from 'node:fs';
import path from 'node:path';
import { fetchPage, jar, sleepBetween } from './http.mjs';
import { BASE, DATA, UA, loadEnv } from './util.mjs';

const URLS_FILE = path.join(DATA, 'post_urls.json');
const POST_RE = new RegExp(`https?://rhythm-sub\\.com/20\\d{2}/\\d{2}/\\d{2}/[^"'#<>\\s]+`, 'g');

function extractUrls(html) {
  return [...new Set((html.match(POST_RE) ?? []).map((u) => u.replace(/\/+$/, '')))];
}

async function crawlPagination() {
  const urls = [];
  for (let page = 1; page <= 200; page++) {
    const { status, html, redirectedTo } = await fetchPage(`${BASE}/page/${page}/`);
    if (redirectedTo || status === 404 || !html) {
      console.log(`page/${page}/ -> stop (${status}${redirectedTo ? ' redirect' : ''})`);
      break;
    }
    const found = extractUrls(html);
    urls.push(...found);
    if (page % 10 === 0) console.log(`page ${page}: total ${urls.length}`);
    await sleepBetween(400);
  }
  return urls;
}

async function crawlAnimeLists() {
  const { html } = await fetchPage(`${BASE}/anime-lists/`);
  return html ? extractUrls(html) : [];
}

async function main() {
  loadEnv();
  jar.load();
  console.log('crawling pagination...');
  const fromPages = await crawlPagination();
  console.log(`pagination URLs: ${fromPages.length}`);

  console.log('crawling anime-lists...');
  const fromList = await crawlAnimeLists();
  console.log(`anime-lists URLs: ${fromList.length}`);

  const all = [...new Set([...fromPages, ...fromList])].sort();
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(URLS_FILE, JSON.stringify(all, null, 2));
  console.log(`TOTAL unique posts: ${all.length} -> ${URLS_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
