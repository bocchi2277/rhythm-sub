import fs from 'node:fs';
import path from 'node:path';

const FONTS = [
  ['arabic', 400],
  ['arabic', 500],
  ['arabic', 700],
  ['latin', 400],
  ['latin', 500],
  ['latin', 700]
];

const OUT = path.resolve('public/fonts');
fs.mkdirSync(OUT, { recursive: true });

for (const [subset, weight] of FONTS) {
  const name = `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`;
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest)) {
    console.log('skip', name);
    continue;
  }
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans-arabic@latest/${subset}-${weight}-normal.woff2`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('FAIL', name, res.status);
    process.exit(1);
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('ok', name, res.headers.get('content-length'));
}
console.log('fonts ready');
