import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Post-build step: replace the CSP's script-src 'unsafe-inline' with
 * per-page SHA-256 hashes of every inline script.
 *
 * Next.js static export inlines the hydration/flight payloads, so a single
 * static header policy cannot enumerate them. Instead:
 *  - public/_headers drops script-src/default-src (scripts are governed by
 *    the per-page meta CSP below; all other directives stay at the edge),
 *  - this script injects <meta http-equiv="Content-Security-Policy"> as the
 *    FIRST child of <head> on every exported page, listing 'self' + the
 *    exact hashes of that page's inline scripts, plus script-src-attr 'none'.
 *
 * Runs AFTER inline-css.mjs (which does not touch scripts). Idempotent.
 * Usage: node scripts/csp-hashes.mjs [out-dir]
 */
const OUT = path.resolve(process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../out'));

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

// Inline scripts only (no src=). The non-greedy body match ends at the first
// </script> — exactly how the browser's HTML parser tokenizes script text.
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const META_RE = /<meta http-equiv="Content-Security-Policy"[^>]*>/;

let pages = 0;
let scriptCount = 0;
let skipped = 0;
for (const file of collectHtml(OUT)) {
  let html = fs.readFileSync(file, 'utf8');
  const hashes = new Set();
  for (const m of html.matchAll(INLINE_SCRIPT)) {
    // Hash the raw text node byte-for-byte (script is a raw-text element:
    // no entity decoding happens before execution). CSP hash-sources MUST
    // be single-quoted ('sha256-...') — a bare token is an invalid source
    // that browsers silently ignore, blocking every inline script.
    hashes.add(`'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  const csp = `script-src 'self' ${[...hashes].join(' ')}; script-src-attr 'none'`;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}"/>`;
  if (META_RE.test(html)) {
    html = html.replace(META_RE, meta);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>${meta}`);
  } else {
    console.warn(`WARN: no <head> in ${path.relative(OUT, file)} — CSP meta NOT injected`);
    skipped++;
    continue;
  }
  fs.writeFileSync(file, html);
  pages++;
  scriptCount += hashes.size;
}

if (skipped > 0) {
  console.error(`${skipped} page(s) missing <head> — failing so the gap cannot ship silently.`);
  process.exit(1);
}
console.log(`CSP: ${pages} pages hardened, ${scriptCount} inline-script hashes injected (script-src 'unsafe-inline' is no longer needed).`);
