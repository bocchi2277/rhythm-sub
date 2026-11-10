import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('out');

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

let changed = 0;
let bytes = 0;
const cssCache = new Map();

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
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
    bytes += safeCss.length;
  }

  if (!html.includes('<style>')) {
    throw new Error(`CSS was not inlined into ${path.relative(OUT, file)}`);
  }
  fs.writeFileSync(file, html);
  changed++;
}

if (changed !== files.length) {
  throw new Error(`Only inlined CSS into ${changed}/${files.length} pages`);
}
console.log(`inlined CSS into ${changed}/${files.length} pages (+${(bytes / 1048576).toFixed(1)}MB total)`);