import fs from 'node:fs';
import path from 'node:path';
import { fetchPage, sleepBetween } from './http.mjs';
import { ensureSession } from './login.mjs';
import { BASE, DATA, loadEnv, writeJsonAtomic } from './util.mjs';

const URLS_FILE = path.join(DATA, 'post_urls.json');
const POST_RE = new RegExp(`https?://rhythm-sub\\.com/20\\d{2}/\\d{2}/\\d{2}/[^"'#<>\\s]+`, 'g');

function extractUrls(html) {
  return [...new Set((html.match(POST_RE) ?? []).map((u) => u.replace(/\/+$/, '')))];
}

// A wp-login redirect means the session expired mid-crawl: force a fresh
// login and retry the same URL once before giving up on it.
async function fetchWithRelogin(url) {
  let res = await fetchPage(url);
  if (res.redirectedTo && /wp-login/.test(res.redirectedTo)) {
    console.log(`wp-login redirect for ${url} — re-authenticating and retrying once`);
    await ensureSession({ force: true });
    res = await fetchPage(url);
  }
  return res;
}

async function crawlPagination() {
  const urls = [];
  for (let page = 1; page <= 200; page++) {
    const { status, html, redirectedTo } = await fetchWithRelogin(`${BASE}/page/${page}/`);
    // Only a verified 404 proves we walked past the last page.
    if (status === 404) {
      console.log(`page/${page}/ -> 404, end of pagination`);
      break;
    }
    if (status === 200 && html) {
      const found = extractUrls(html);
      // A successfully fetched page with zero post URLs also ends pagination.
      if (found.length === 0) {
        console.log(`page/${page}/ -> 200 but no post URLs, end of pagination`);
        break;
      }
      urls.push(...found);
    } else {
      // Arbitrary redirects / transient errors are NOT proof of the end:
      // keep going (the inventory merge below protects against partial runs).
      console.warn(`page/${page}/ -> unexpected response (${status}${redirectedTo ? ` redirect to ${redirectedTo}` : ''}), continuing`);
    }
    if (page % 10 === 0) console.log(`page ${page}: total ${urls.length}`);
    await sleepBetween(400);
  }
  return urls;
}

async function crawlAnimeLists() {
  const { html } = await fetchWithRelogin(`${BASE}/anime-lists/`);
  return html ? extractUrls(html) : [];
}

async function main() {
  loadEnv();
  await ensureSession();
  console.log('crawling pagination...');
  const fromPages = await crawlPagination();
  console.log(`pagination URLs: ${fromPages.length}`);

  console.log('crawling anime-lists...');
  const fromList = await crawlAnimeLists();
  console.log(`anime-lists URLs: ${fromList.length}`);

  const all = [...new Set([...fromPages, ...fromList])].sort();
  if (all.length === 0) {
    throw new Error('Crawl discovered 0 post URLs — refusing to overwrite post_urls.json with an empty inventory.');
  }

  // Merge with the existing inventory instead of replacing it: a partial
  // crawl (challenge page, early stop, network failure) must never shrink
  // post_urls.json and orphan already-scraped posts.
  let existing = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
    if (Array.isArray(parsed)) existing = parsed.filter((u) => typeof u === 'string');
  } catch {}
  const merged = [...new Set([...existing, ...all])].sort();

  fs.mkdirSync(DATA, { recursive: true });
  writeJsonAtomic(URLS_FILE, merged);
  console.log(`TOTAL unique posts: ${merged.length} (crawl found ${all.length}, existing ${existing.length}) -> ${URLS_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});