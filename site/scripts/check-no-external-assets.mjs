import fs from 'node:fs';
import path from 'node:path';

/**
 * Regression gate: the static export must not LOAD any third-party asset.
 *
 * Every image is rewritten to a local WebP by lib/images.ts and the HTML
 * allowlist sanitizer drops third-party <img src> values, so an external
 * asset URL in the exported HTML means one of those guards was bypassed —
 * which is exactly the "compromised upstream beacons every visitor" case.
 *
 * Only subresource-loading attributes are checked (src / srcset / poster, and
 * <link> href). Ordinary outbound <a href> links are expected and ignored.
 *
 * Usage: node scripts/check-no-external-assets.mjs [out-dir]
 * Exit code 0 = clean, 1 = external asset reference found.
 */

const OUT = path.resolve(process.argv[2] ?? 'out');

function collectHtml(dir, acc = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) collectHtml(full, acc);
    else if (f.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

if (!fs.existsSync(OUT)) {
  console.error(`No built output at ${OUT} — run "npm run build" first.`);
  process.exit(1);
}

// Hosts the site legitimately loads subresources from.
const ALLOWED_HOSTS = new Set(['www.youtube-nocookie.com', 'www.youtube.com']);

// <img|script|iframe|video|audio|source|embed|input src="...">, poster="..."
const SRCSRC = /<(?:img|script|iframe|video|audio|source|embed|input|track)\b[^>]*?\bsrc\s*=\s*"(https?:\/\/[^"]+)"/gi;
const POSTER = /<(?:video|body)\b[^>]*?\bposter\s*=\s*"(https?:\/\/[^"]+)"/gi;
const SRCSET = /\bsrcset\s*=\s*"([^"]+)"/gi;
// <link href="..."> — stylesheets and preloads are subresources too.
const LINK = /<link\b[^>]*?\bhref\s*=\s*"(https?:\/\/[^"]+)"/gi;

const files = collectHtml(OUT);
const offenders = [];

const record = (file, url) => {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return;
  }
  if (ALLOWED_HOSTS.has(host)) return;
  offenders.push({ file: path.relative(OUT, file), url });
};

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(SRCSRC)) record(file, m[1]);
  for (const m of html.matchAll(POSTER)) record(file, m[1]);
  for (const m of html.matchAll(LINK)) record(file, m[1]);
  for (const m of html.matchAll(SRCSET)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (/^https?:\/\//i.test(url)) record(file, url);
    }
  }
}

if (offenders.length > 0) {
  const unique = [...new Map(offenders.map((o) => [`${o.file}|${o.url}`, o])).values()];
  console.error(`Found ${offenders.length} third-party asset reference(s) in ${unique.length} distinct location(s):`);
  for (const o of unique.slice(0, 20)) console.error(`  ${o.file}: ${o.url}`);
  process.exit(1);
}

console.log(`OK — no third-party subresource references in ${files.length} pages.`);
