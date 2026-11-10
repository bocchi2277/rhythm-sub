import fs from 'node:fs';
import path from 'node:path';
import { ensureSession } from './login.mjs';
import { fetchPage, sleepBetween } from './http.mjs';
import { parsePost } from './parse.mjs';
import { DATA, POSTS_DIR, loadEnv, slugFromUrl, ensureDirs, writeJsonAtomic } from './util.mjs';

const URLS_FILE = path.join(DATA, 'post_urls.json');
const DELAY_MS = Number(process.env.SCRAPE_DELAY ?? 400);
const LIMIT = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : Infinity;

function outFile(url) {
  return path.join(POSTS_DIR, `${slugFromUrl(url)}.json`);
}

async function main() {
  loadEnv();
  await ensureSession();
  ensureDirs();

  let urls = [];
  try {
    urls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
    if (!Array.isArray(urls)) throw new Error('post_urls.json is not an array');
  } catch (e) {
    throw new Error(`Failed to read ${URLS_FILE}: ${e?.message ?? e}. Run crawl/sync first.`);
  }
  const todo = urls.filter((u) => !fs.existsSync(outFile(u))).slice(0, LIMIT === Infinity ? urls.length : LIMIT);
  console.log(`total ${urls.length} | done ${urls.length - todo.length} | to scrape ${todo.length}`);

  let ok = 0;
  const failed = [];
  const startedAt = Date.now();

  for (let i = 0; i < todo.length; i++) {
    const url = todo[i];
    try {
      let { status, html, redirectedTo } = await fetchPage(url);

      if (redirectedTo && /wp-login/.test(redirectedTo)) {
        console.log('session expired, re-login...');
        await ensureSession({ force: true });
        ({ status, html, redirectedTo } = await fetchPage(url));
      }

      if (status !== 200 || !html || redirectedTo) {
        failed.push({ url, status });
        console.log(`FAIL [${status}] ${url}`);
      } else {
        const data = parsePost(html, url);
        writeJsonAtomic(outFile(url), data);
        ok++;
        if (ok % 25 === 0) {
          const rate = ((Date.now() - startedAt) / 1000 / ok).toFixed(1);
          console.log(`${ok}/${todo.length} done (~${rate}s/post)`);
        }
      }
    } catch (e) {
      failed.push({ url, error: String(e?.message ?? e) });
      console.log(`ERR ${url}: ${e?.message ?? e}`);
    }
    await sleepBetween(DELAY_MS);
  }

  writeJsonAtomic(path.join(DATA, 'scrape_failures.json'), failed);
  console.log(`DONE ok=${ok} failed=${failed.length} (failures saved to scrape_failures.json)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
