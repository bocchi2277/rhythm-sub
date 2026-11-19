// Recovery tool: fetch episodes that exist on the source (authoritative REST
// inventory, application-password auth) but are missing from our inventory.
// The homepage crawl only sees ~3 recent pages, so episodes published while
// the pipeline was down (or challenged by Cloudflare) can fall out of view
// permanently — this tool finds and repairs those gaps.
//
// Auth: RHYTHM_APP_PASSWORD (WordPress Application Password, never expires)
// for the REST inventory; the scraper's normal session (fresh wp-login works
// from residential IPs) for the HTML pages, because the theme renders the
// download boxes + metadata OUTSIDE the_content — REST content.rendered does
// not contain them (probed 2026-11-19: no .soraddl/.soraurl/ul.spe markers).
//
// Usage: npm run recover   (from scraper/)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA, POSTS_DIR, loadEnv, slugFromUrl, writeJsonAtomic } from '../src/util.mjs';
import { fetchPage, jar, sleepBetween } from '../src/http.mjs';
import { ensureSession } from '../src/login.mjs';
import { parsePost } from '../src/parse.mjs';
import { isValidPost } from '../src/build-model.mjs';

loadEnv();
if (!process.env.RHYTHM_APP_PASSWORD) {
  console.error('RHYTHM_APP_PASSWORD is not set. Create an Application Password on your WordPress profile page and add it to scraper/.env (local) or GitHub secrets (CI).');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(process.env.RHYTHM_USER + ':' + process.env.RHYTHM_APP_PASSWORD).toString('base64');

// 1. Authoritative inventory via REST.
const all = [];
for (let page = 1; page <= 50; page++) {
  const r = await fetch(`https://rhythm-sub.com/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=slug,link,date&orderby=date&order=desc`, { headers: { Authorization: auth } });
  if (!r.ok) throw new Error(`REST page ${page}: HTTP ${r.status}`);
  all.push(...(await r.json()));
  if (page >= Number(r.headers.get('x-wp-totalpages') || 1)) break;
}
const URLS_FILE = path.join(DATA, 'post_urls.json');
const inventory = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
const invSet = new Set(inventory.map((u) => u.replace(/\/+$/, '')));
const missing = all.filter((p) => !invSet.has(p.link.replace(/\/+$/, '')));
console.log(`REST total: ${all.length} | inventory: ${inventory.length} | missing: ${missing.length}`);
if (!missing.length) {
  console.log('nothing to recover');
  process.exit(0);
}

// 2. Fresh session, then fetch + parse each missing post's HTML.
jar.load();
await ensureSession();
let ok = 0;
const failed = [];
for (const p of missing) {
  const url = p.link.replace(/\/+$/, '') + '/';
  try {
    const { status, html, redirectedTo } = await fetchPage(url);
    if (status !== 200 || !html) {
      failed.push(`${p.slug}: HTTP ${status} ${redirectedTo ?? ''}`);
      continue;
    }
    const post = parsePost(html, url);
    if (!isValidPost(post)) {
      failed.push(`${p.slug}: invalid shape after parse`);
      continue;
    }
    writeJsonAtomic(path.join(POSTS_DIR, `${slugFromUrl(url)}.json`), post);
    invSet.add(url);
    ok++;
    console.log(`recovered: ${post.title} (${post.downloads.reduce((n, d) => n + d.qualities.length, 0)} quality rows)`);
    await sleepBetween(400);
  } catch (e) {
    failed.push(`${p.slug}: ${e.message}`);
  }
}

// 3. Merge-never-shrink inventory write + model rebuild.
writeJsonAtomic(URLS_FILE, [...invSet].sort());
console.log(`recovered ${ok}/${missing.length}; inventory now ${invSet.size}`);
if (failed.length) {
  console.log('FAILED:\n' + failed.join('\n'));
  process.exitCode = 1;
}
execFileSync(process.execPath, [path.resolve(DATA, '../scraper/src/build-model.mjs')], { stdio: 'inherit', cwd: path.resolve(DATA, '..') });
