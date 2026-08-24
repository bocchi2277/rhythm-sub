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
let changed = 0;
let bytes = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const links = [...html.matchAll(/<link[^>]+href="(\/_next\/[^"]+\.css)"[^>]*>/g)];

  if (!links.length && !html.includes('<style>') && html.includes('/_next/static/css/')) {
    const cssRef = html.match(/\/_next\/static\/css\/([a-f0-9]+\.css)/);
    if (cssRef) {
      const cssPath = path.join(OUT, '_next', 'static', 'css', cssRef[1]);
      let css = '';
      try {
        css = fs.readFileSync(cssPath, 'utf8');
      } catch {}
      if (css) {
        html = html.replace('</head>', `<style>${css}</style></head>`);
        bytes += css.length;
        changed++;
        fs.writeFileSync(file, html);
        continue;
      }
    }
  }

  if (!links.length) continue;

  for (const m of links) {
    const cssPath = path.join(OUT, ...m[1].split('/'));
    let css = '';
    try {
      css = fs.readFileSync(cssPath, 'utf8');
    } catch {
      continue;
    }
    html = html.replace(m[0], `<style>${css}</style>`);
    bytes += css.length;
  }

  fs.writeFileSync(file, html);
  changed++;
}

console.log(`inlined CSS into ${changed}/${files.length} pages (+${(bytes / 1048576).toFixed(1)}MB total)`);
