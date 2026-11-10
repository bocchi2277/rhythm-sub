import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('out');

// Inlining the compiled stylesheet into every page removes one render-
// blocking round trip, but it also duplicates the CSS into all ~440 exported
// HTML files (18MB of build output) and — because the CSS is no longer an
// external subresource — the browser cannot cache it across navigations.
//
// Set SKIP_CSS_INLINE=1 to keep the normal <link rel="stylesheet"> instead:
// the stylesheet is then fetched once and served from the immutable cache
// (see public/_headers). Measure both variants before choosing.
const SKIP = process.env.SKIP_CSS_INLINE === '1' || process.env.SKIP_CSS_INLINE === 'true';

function collectHtml(dir, acc = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) collectHtml(full, acc);
    else if (f.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const files = collectHtml(OUT);
if (files.length === 0) throw new Error(`No built HTML found under ${OUT}`);

if (SKIP) {
  let linked = 0;
  for (const f of files) {
    if (/<link[^>]+href="\/_next\/[^"]+\.css"/.test(fs.readFileSync(f, 'utf8'))) linked++;
  }
  console.log(`SKIP_CSS_INLINE=1 — kept the external stylesheet link in ${linked}/${files.length} pages.`);
  process.exit(0);
}

let changed = 0;
let totalBytes = 0;
const cssCache = new Map();

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let html = original;
  const links = [...html.matchAll(/<link[^>]+href="(\/_next\/[^"]+\.css)"[^>]*>/g)];
  const cssRefs = [...new Set([...html.matchAll(/\/_next\/static\/css\/[a-f0-9]+\.css/g)].map((m) => m[0]))];

  if (cssRefs.length === 0) {
    throw new Error(`No compiled CSS reference found in ${path.relative(OUT, file)}`);
  }

  for (const ref of cssRefs) {
    // Cache the compiled CSS: without it every page re-reads the same 42KB file.
    let css = cssCache.get(ref);
    if (!css) {
      const cssPath = path.join(OUT, ...ref.split('/'));
      css = fs.readFileSync(cssPath, 'utf8');
      cssCache.set(ref, css);
    }
    if (!css.trim()) throw new Error(`Empty compiled CSS: ${ref}`);
    const safeCss = css.replace(/<\/style/gi, '<\\/style');
    const style = `<style>${safeCss}</style>`;
    const before = html;
    for (const m of links.filter((l) => l[1] === ref)) {
      html = html.replace(m[0], () => style);
    }
    if (html === before && !html.includes('<style>')) {
      html = html.replace('</head>', () => `${style}</head>`);
    }
    // One copy of the stylesheet per page (cssRefs is de-duplicated above).
    totalBytes += safeCss.length;
  }

  if (!html.includes('<style>')) {
    throw new Error(`CSS was not inlined into ${path.relative(OUT, file)}`);
  }
  // Only rewrite when the content actually changed.
  if (html !== original) {
    fs.writeFileSync(file, html);
    changed++;
  }
}

if (changed !== files.length) {
  throw new Error(`Only inlined CSS into ${changed}/${files.length} pages`);
}
console.log(`inlined CSS into ${changed}/${files.length} pages (+${(totalBytes / 1048576).toFixed(1)}MB total)`);
