import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = (await import('../../site/node_modules/sharp/lib/index.js')).default;
}
import { fetchPage, jar, sleepBetween } from './http.mjs';
import { ensureSession } from './login.mjs';
import { parsePost } from './parse.mjs';
import { DATA, POSTS_DIR, BASE, loadEnv, slugFromUrl, ensureDirs } from './util.mjs';

const POST_RE = new RegExp(`https?://rhythm-sub\\.com/20\\d{2}/\\d{2}/\\d{2}/[^"'#<>\\s]+`, 'g');
const URLS_FILE = path.join(DATA, 'post_urls.json');
const OUT_DIR = path.resolve(DATA, '../site/public/img');
const MANIFEST = path.resolve(DATA, '../site/public/img-manifest.json');
const UA_IMG = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36';

function extractUrls(html) {
  return [...new Set((html.match(POST_RE) ?? []).map((u) => u.replace(/\/+$/, '')))];
}

async function fetchRecentUrls() {
  const urls = new Set();

  // 1. Fetch homepage & page 2
  for (let page = 1; page <= 3; page++) {
    const target = page === 1 ? `${BASE}/` : `${BASE}/page/${page}/`;
    try {
      let { html, redirectedTo } = await fetchPage(target);
      if (redirectedTo && /wp-login/.test(redirectedTo)) {
        await ensureSession({ force: true });
        ({ html } = await fetchPage(target));
      }
      if (html) {
        for (const u of extractUrls(html)) urls.add(u);
      }
    } catch (e) {
      console.warn(`Warning: failed to fetch ${target}:`, e.message);
    }
  }

  // 2. Fetch RSS feed as backup
  try {
    let { html: feedXml, redirectedTo } = await fetchPage(`${BASE}/feed/`);
    if (redirectedTo && /wp-login/.test(redirectedTo)) {
      await ensureSession({ force: true });
      ({ html: feedXml } = await fetchPage(`${BASE}/feed/`));
    }
    if (feedXml) {
      for (const u of extractUrls(feedXml)) urls.add(u);
    }
  } catch {}

  return [...urls].sort();
}

async function downloadAndOptimizeImage(url, manifest) {
  if (manifest[url] && fs.existsSync(path.join(OUT_DIR, manifest[url].replace(/^\/img\//, '')))) {
    return manifest[url];
  }

  const outFileName = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16) + '.webp';
  const outPath = path.join(OUT_DIR, outFileName);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA_IMG, Referer: BASE },
      signal: ctrl.signal
    });
    clearTimeout(t);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

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
    fs.writeFileSync(outPath, webpBuf);
    manifest[url] = `/img/${outFileName}`;
    console.log(`  📸 Image saved: ${url} -> ${manifest[url]}`);
    return manifest[url];
  } catch (e) {
    console.warn(`  ⚠️ Failed to download image ${url}:`, e.message);
    return null;
  }
}

export async function syncNewReleases(options = {}) {
  const { autoPush = false, autoBuild = false } = options;
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
  } catch {}

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
  } catch {}

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
    fs.writeFileSync(outFile, JSON.stringify(postData, null, 2));
    newTitles.push(postData.title);
    console.log(`  ✅ Parsed: "${postData.title}"`);

    // Collect images
    if (postData.cover) newImages.add(postData.cover);
    for (const im of postData.contentImages ?? []) newImages.add(im);
    for (const q of postData.qualities ?? []) {
      for (const l of q.links ?? []) {
        // any quality links
      }
    }

    existingSet.add(url);
    await sleepBetween(400);
  }

  // Update post_urls.json
  const updatedList = [...existingSet].sort();
  fs.writeFileSync(URLS_FILE, JSON.stringify(updatedList, null, 2));

  // Process & optimize new images
  if (newImages.size > 0) {
    console.log(`\n🖼️ Optimizing ${newImages.size} image(s)...`);
    for (const imgUrl of newImages) {
      if (imgUrl.includes('rhythm-sub.com/wp-content')) {
        await downloadAndOptimizeImage(imgUrl, manifest);
      }
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  // Rebuild data model (series.json)
  console.log('\n🏗️ Rebuilding series & episode model...');
  execSync('node scraper/src/build-model.mjs', { stdio: 'inherit' });

  // Optional build site
  if (autoBuild) {
    console.log('\n🚀 Building site pages...');
    execSync('npm run build', { cwd: path.resolve(DATA, '../site'), stdio: 'inherit' });
  }

  // Optional Git commit & push
  if (autoPush) {
    console.log('\n📤 Pushing changes to GitHub...');
    const commitMsg = `Sync new release: ${newTitles.slice(0, 3).join(', ')}${newTitles.length > 3 ? ` (+${newTitles.length - 3} more)` : ''}`;
    try {
      execSync('git add data/ site/public/img/ site/public/img-manifest.json', { stdio: 'inherit' });
      execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('✅ Push complete! Cloudflare Pages will deploy shortly.');
    } catch (e) {
      console.error('Git push failed:', e.message);
    }
  }

  console.log(`\n🎉 Successfully synced ${newTitles.length} new release(s)!`);
  return { count: newTitles.length, newTitles };
}

// CLI direct run
if (process.argv[1]?.endsWith('sync.mjs')) {
  const autoPush = process.argv.includes('--push') || process.argv.includes('--git');
  const autoBuild = process.argv.includes('--build');
  syncNewReleases({ autoPush, autoBuild }).catch((e) => {
    console.error('Fatal sync error:', e);
    process.exit(1);
  });
}
