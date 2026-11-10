import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Fallback for checkouts where sharp is only installed under site/ (the site
  // package declares it). Declared in scraper/package.json as the primary source.
  sharp = (await import('../../site/node_modules/sharp/lib/index.js')).default;
}
import { fetchPage, jar, sleepBetween, usingInjectedCookie } from './http.mjs';
import { ensureSession } from './login.mjs';
import { parsePost } from './parse.mjs';
import { DATA, POSTS_DIR, BASE, loadEnv, slugFromUrl, ensureDirs, isAllowedImageHost, readBodyLimited, writeJsonAtomic, writeFileAtomic, fetchAllowedImage } from './util.mjs';

const POST_RE = new RegExp(`https?://rhythm-sub\\.com/20\\d{2}/\\d{2}/\\d{2}/[^"'#<>\\s]+`, 'g');
const URLS_FILE = path.join(DATA, 'post_urls.json');
const OUT_DIR = path.resolve(DATA, '../site/public/img');
const MANIFEST = path.resolve(DATA, '../site/img-manifest.json');
const UA_IMG = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Exactly the paths a sync run is allowed to stage/commit. Shared by --push
// (local) and --commit-only (CI pushes the snapshot first, then main itself).
const COMMIT_PATHS = [
  'data/series.json',
  'data/post_urls.json',
  'data/image_map.json',
  'data/pages',
  'data/releases',
  'site/public/img',
  'site/img-manifest.json'
];

function extractUrls(html) {
  return [...new Set((html.match(POST_RE) ?? []).map((u) => u.replace(/\/+$/, '')))];
}

// When auth is delegated to an injected cookie, a redirect to wp-login means
// the cookie is dead — forcing a login would only fail against a blocked
// wp-login.php, so surface a message the operator can actually act on.
async function reauthOrThrow() {
  if (usingInjectedCookie()) {
    throw new Error(
      'RHYTHM_COOKIE was rejected by rhythm-sub.com (expired or invalid). ' +
        'Refresh it: log in with "remember me" checked, copy the Cookie request ' +
        'header, then update the RHYTHM_COOKIE GitHub secret.'
    );
  }
  await ensureSession({ force: true });
}

async function fetchRecentUrls() {
  const urls = new Set();

  // 1. Fetch homepage & page 2
  for (let page = 1; page <= 3; page++) {
    const target = page === 1 ? `${BASE}/` : `${BASE}/page/${page}/`;
    try {
      let { status, html, redirectedTo } = await fetchPage(target);
      if (redirectedTo && /wp-login/.test(redirectedTo)) {
        await reauthOrThrow();
        ({ status, html } = await fetchPage(target));
      }
      if (html) {
        const found = extractUrls(html);
        const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
        // Surfacing status + size + title makes a bot-challenge page (which
        // returns HTTP 200 with no post links) obvious in the run log.
        console.log(`   ${target} -> ${status}, ${html.length}B, ${found.length} post link(s)${title ? `, title="${title.slice(0, 60)}"` : ''}`);
        for (const u of found) urls.add(u);
      } else {
        console.warn(`   ${target} -> NO HTML (redirectedTo=${redirectedTo ?? 'none'})`);
      }
    } catch (e) {
      console.warn(`Warning: failed to fetch ${target}:`, e.message);
    }
  }
  if (urls.size === 0) {
    console.warn('⚠️  No post URLs discovered on any page. A 200 response with zero links usually means the upstream served a bot-challenge page to this IP — the saved cookie authenticates the WordPress session but does not satisfy a Cloudflare challenge.');
  }

  // 2. Fetch RSS feed as backup
  try {
    let { html: feedXml, redirectedTo } = await fetchPage(`${BASE}/feed/`);
    if (redirectedTo && /wp-login/.test(redirectedTo)) {
      await reauthOrThrow();
      ({ html: feedXml } = await fetchPage(`${BASE}/feed/`));
    }
    if (feedXml) {
      for (const u of extractUrls(feedXml)) urls.add(u);
    }
  } catch {}

  return [...urls].sort();
}

async function downloadAndOptimizeImage(url, manifest) {
  if (!isAllowedImageHost(url)) {
    console.warn(`  ⛔ Refusing image from disallowed host: ${url}`);
    return null;
  }
  if (manifest[url] && fs.existsSync(path.join(OUT_DIR, manifest[url].replace(/^\/img\//, '')))) {
    return manifest[url];
  }

  const outFileName = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.webp';
  const outPath = path.join(OUT_DIR, outFileName);

  try {
    // fetchAllowedImage re-validates the host on every redirect hop and
    // refuses a non-image content-type before anything is buffered.
    const res = await fetchAllowedImage(url, { referer: BASE, ua: UA_IMG, timeoutMs: 15000 });
    const buf = await readBodyLimited(res, MAX_IMAGE_BYTES);

    const isCover = /\/l\.(jpg|jpeg|png|webp)$/i.test(url) || /mal-logo|logo/i.test(url);
    const img = sharp(buf, { failOn: 'none' });
    const meta = await img.metadata();
    let pipe = img.rotate().webp({ quality: 78, effort: 3 });

    if ((meta.width ?? 0) > 1400 && !isCover) {
      pipe = sharp(buf, { failOn: 'none' }).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 78, effort: 3 });
    } else if ((meta.width ?? 0) > 900) {
      pipe = sharp(buf, { failOn: 'none' }).rotate().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78, effort: 3 });
    }

    const webpBuf = await pipe.toBuffer();
    writeFileAtomic(outPath, webpBuf);
    manifest[url] = `/img/${outFileName}`;
    console.log(`  📸 Image saved: ${url} -> ${manifest[url]}`);
    return manifest[url];
  } catch (e) {
    console.warn(`  ⚠️ Failed to download image ${url}:`, e.message);
    return null;
  }
}

// Invoke npm portably (Windows has npm.cmd, which execFileSync cannot launch
// without a shell). Run npm's CLI JS with the current node binary instead —
// argv stays an array, so no shell interpolation of scraped input is possible.
function npmCliPath() {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    return process.env.npm_execpath;
  }
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows layout
    path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js') // POSIX layout
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function runNpm(args, cwd) {
  const cli = npmCliPath();
  if (cli) {
    execFileSync(process.execPath, [cli, ...args], { cwd, stdio: 'inherit' });
  } else if (process.platform !== 'win32') {
    execFileSync('npm', args, { cwd, stdio: 'inherit' });
  } else {
    throw new Error('Could not locate npm-cli.js; run the build manually with "npm run build" in site/.');
  }
}

export async function syncNewReleases(options = {}) {
  const { autoPush = false, autoBuild = false, commitOnly = false } = options;
  loadEnv();
  jar.load();
  ensureDirs();

  await ensureSession();

  console.log('🔄 Checking Rhythm-Sub for new releases...');
  const discovered = await fetchRecentUrls();
  console.log(`Found ${discovered.length} recent posts on Rhythm-Sub.`);

  // Load existing URLs
  let existingUrls = [];
  try {
    existingUrls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
    if (!Array.isArray(existingUrls)) throw new Error('post_urls.json is not an array');
  } catch (e) {
    console.warn(`⚠️ Could not read ${URLS_FILE} (${e.message}); every discovered post will be treated as new.`);
  }

  const existingSet = new Set(existingUrls);
  const newUrls = discovered.filter((u) => {
    const slug = slugFromUrl(u);
    const postFile = path.join(POSTS_DIR, `${slug}.json`);
    return !existingSet.has(u) || !fs.existsSync(postFile);
  });

  if (newUrls.length === 0) {
    console.log('✅ All releases are up to date! No new episodes found.');
    return { count: 0, newTitles: [] };
  }

  console.log(`⚡ Discovered ${newUrls.length} new post(s) to sync:`);
  for (const u of newUrls) console.log(`   - ${u}`);

  await ensureSession();

  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ Could not read ${MANIFEST} (${e.message}); images will be re-downloaded/re-optimized.`);
  }

  const newTitles = [];
  const newImages = new Set();

  for (const url of newUrls) {
    console.log(`\n📥 Fetching & parsing: ${url}`);
    let { status, html, redirectedTo } = await fetchPage(url);
    if (redirectedTo && /wp-login/.test(redirectedTo)) {
      await ensureSession({ force: true });
      ({ status, html, redirectedTo } = await fetchPage(url));
    }

    if (status !== 200 || !html) {
      console.error(`❌ Failed to fetch [${status}] ${url}`);
      continue;
    }

    const postData = parsePost(html, url);
    const slug = slugFromUrl(url);
    const outFile = path.join(POSTS_DIR, `${slug}.json`);
    writeJsonAtomic(outFile, postData);
    newTitles.push(postData.title);
    console.log(`  ✅ Parsed: "${postData.title}"`);

    // Collect images
    if (postData.cover) newImages.add(postData.cover);
    for (const im of postData.contentImages ?? []) newImages.add(im);

    existingSet.add(url);
    await sleepBetween(400);
  }

  // Update post_urls.json
  const updatedList = [...existingSet].sort();
  writeJsonAtomic(URLS_FILE, updatedList);

  // Process & optimize new images
  if (newImages.size > 0) {
    console.log(`\n🖼️ Optimizing ${newImages.size} image(s)...`);
    for (const imgUrl of newImages) {
      if (isAllowedImageHost(imgUrl)) {
        await downloadAndOptimizeImage(imgUrl, manifest);
      }
    }
    writeJsonAtomic(MANIFEST, manifest);
  }

  // Guard: never rebuild from a partial POSTS_DIR (e.g. CI run where the
  // sync-data snapshot failed to restore, or a run where some fetches
  // failed). Rebuilding from fewer files than known URLs would silently
  // DROP posts from series.json. Fail loudly instead — the next run retries.
  const expectedPosts = [...existingSet].length;
  const postFiles = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.json')).length;
  if (postFiles < expectedPosts) {
    throw new Error(
      `Refusing to rebuild: ${postFiles} post files but ${expectedPosts} known URLs. ` +
        `Restore data/posts from the sync-data branch snapshot (or run sync locally with full history) instead of wiping series.json.`
    );
  }

  // Rebuild data model (series.json)
  console.log('\n🏗️ Rebuilding series & episode model...');
  execFileSync(process.execPath, [path.resolve(DATA, '../scraper/src/build-model.mjs')], {
    stdio: 'inherit',
    cwd: path.resolve(DATA, '..')
  });

  // Optional build site
  if (autoBuild) {
    console.log('\n🚀 Building site pages...');
    runNpm(['run', 'build'], path.resolve(DATA, '../site'));
  }

  // Optional Git commit (and push for local --push runs). --commit-only stages
  // and commits exactly the allowlisted paths but never pushes: CI pushes the
  // sync-data snapshot first, then main, so a failed snapshot can't leave main
  // referencing posts that were never archived.
  if (autoPush || commitOnly) {
    console.log(autoPush ? '\n📤 Committing & pushing changes to GitHub...' : '\n💾 Committing changes (no push)...');
    // commitMsg is built from scraped post titles — untrusted input. It is passed
    // as an argv element via execFileSync, so it can never reach a shell.
    const cleanTitles = newTitles
      .map((t) => String(t).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const commitMsg =
      `Sync new release: ${cleanTitles.slice(0, 3).join(', ')}` +
      `${cleanTitles.length > 3 ? ` (+${cleanTitles.length - 3} more)` : ''}`;
    const repoRoot = path.resolve(DATA, '..');
    try {
      execFileSync('git', ['add', '-A', '--', ...COMMIT_PATHS], { cwd: repoRoot, stdio: 'inherit' });
      // git diff --cached --quiet exits 0 when nothing is staged, 1 when there
      // are staged changes (execFileSync throws on the non-zero exit).
      let committed = false;
      try {
        execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: repoRoot, stdio: 'ignore' });
      } catch {
        execFileSync('git', ['commit', '-m', commitMsg], { cwd: repoRoot, stdio: 'inherit' });
        committed = true;
      }
      if (autoPush) {
        const branch =
          process.env.GITHUB_REF_NAME ??
          execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
        execFileSync('git', ['push', 'origin', branch], { cwd: repoRoot, stdio: 'inherit' });
        console.log('✅ Push complete! Cloudflare Pages will deploy shortly.');
      } else {
        console.log(committed ? '✅ Commit created (not pushed).' : 'ℹ️ Nothing to commit.');
      }
    } catch (e) {
      console.error('Git commit/push failed:', e.message);
      // Never report success when nothing was committed/pushed: CI gates the
      // snapshot update on this exit code.
      process.exitCode = 1;
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error(`\n⚠️ Synced ${newTitles.length} new release(s) locally, but a required git step failed.`);
  } else {
    console.log(`\n🎉 Successfully synced ${newTitles.length} new release(s)!`);
  }
  return { count: newTitles.length, newTitles };
}

// CLI direct run
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const autoPush = process.argv.includes('--push') || process.argv.includes('--git');
  const autoBuild = process.argv.includes('--build');
  const commitOnly = process.argv.includes('--commit-only');
  syncNewReleases({ autoPush, autoBuild, commitOnly }).catch((e) => {
    console.error('Fatal sync error:', e);
    process.exit(1);
  });
}
