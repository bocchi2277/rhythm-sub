import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION = '5.3.0';
const FONTS = [
  ['arabic', 400, '6010e7fd0dce5d527583951750728cbe3c895efbd16aa0f809ab8c824878c9d8'],
  ['arabic', 500, '90aef64fea9794f232332e907d45810ab268d1a11721340025eba2a2cdb36d5c'],
  ['arabic', 700, '04c730b4292731ccedadd5bd80756124364ae4923895145d9cd7b1f28e443de1'],
  ['latin', 400, '9ed8dcb02e6c7246de4c120295fafa39a7bb73085f4951a4524a07dc911069f2'],
  ['latin', 500, 'be6a3b2e37f3ad67aa822a55ce356d28c416331c97530a1ec076c2118240ca2d'],
  ['latin', 700, 'ae2d59f91ecf9f7ed279e4a1fc1a9da8170fb0ce5b9152917a8f759033f5777c']
];

const OUT = path.resolve('public/fonts');
fs.mkdirSync(OUT, { recursive: true });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

for (const [subset, weight, expected] of FONTS) {
  const name = `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`;
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest)) {
    if (sha256(fs.readFileSync(dest)) !== expected) throw new Error(`Font integrity mismatch: ${name}`);
    console.log('skip', name);
    continue;
  }
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-sans-arabic@${VERSION}/${subset}-${weight}-normal.woff2`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`FAIL ${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== expected) throw new Error(`Font integrity mismatch: ${name}`);
  const tmp = `${dest}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
  console.log('ok', name, buf.length);
}
console.log('fonts ready');