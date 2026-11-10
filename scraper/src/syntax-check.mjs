// Minimal smoke test: every scraper module must parse cleanly.
// Modules that do real work guard their entry point, so a parse check is the
// cheapest meaningful gate CI can run without network or credentials.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.mjs')).sort();

let failed = 0;
for (const f of files) {
  const res = spawnSync(process.execPath, ['--check', path.join(SRC, f)], { encoding: 'utf8' });
  if (res.status === 0) {
    console.log(`ok ${f}`);
  } else {
    failed++;
    console.error(`FAIL ${f}\n${res.stderr}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} modules parsed`);
process.exit(failed ? 1 : 0);
