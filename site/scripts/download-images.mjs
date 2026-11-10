import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(ROOT, 'scraper', 'src', 'download-images.mjs');
const res = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
if (res.error) {
  console.error(res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 1);