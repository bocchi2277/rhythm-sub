import fs from 'node:fs';

/**
 * Coverage gate: parse the lcov report produced by
 *   node --test --experimental-test-coverage --test-reporter=lcov \
 *        --test-reporter-destination=coverage.lcov
 * and enforce minimum totals across ALL measured production files
 * (scraper/src + shared/rules.mjs + the site/lib modules loaded by the
 * site-pipeline tests). Test files are not measured by Node's coverage.
 *
 * Deliberately a plain lcov parser instead of --test-coverage-lines flags:
 * CI runs Node 22 while dev machines run newer majors, and the threshold
 * flags are not available on every version in that range. lcov + this
 * parser behaves identically everywhere.
 *
 * Usage: node scripts/check-coverage.mjs <coverage.lcov> [--lines=N] [--branches=N] [--functions=N]
 * Defaults are a ratchet set a few points BELOW the measured baseline
 * (2026-11-19: 72.5% lines / 81.1% branches / 79.7% functions). Raise them
 * as coverage grows; never lower them to make a red build green.
 */

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-coverage.mjs <coverage.lcov> [--lines=N] [--branches=N] [--functions=N]');
  process.exit(2);
}

const thresholds = { lines: 70, branches: 78, functions: 75 };
for (const arg of process.argv.slice(3)) {
  const m = arg.match(/^--(lines|branches|functions)=(\d+(?:\.\d+)?)$/);
  if (!m) {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
  thresholds[m[1]] = Number(m[2]);
}

let lcov;
try {
  lcov = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error(`Cannot read coverage report ${file}: ${e.message}`);
  console.error('Run the coverage test command first (npm run test:coverage).');
  process.exit(2);
}

const totals = { LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 };
for (const line of lcov.split(/\r?\n/)) {
  const idx = line.indexOf(':');
  if (idx < 0) continue;
  const key = line.slice(0, idx);
  if (key in totals) totals[key] += Number(line.slice(idx + 1)) || 0;
}

if (totals.LF === 0) {
  console.error('Coverage report contains no line records — refusing to pass an empty measurement.');
  process.exit(2);
}

const pct = (hit, found) => (found === 0 ? 100 : (hit / found) * 100);
const actual = {
  lines: pct(totals.LH, totals.LF),
  branches: pct(totals.BRH, totals.BRF),
  functions: pct(totals.FNH, totals.FNF)
};

let failed = false;
for (const key of ['lines', 'branches', 'functions']) {
  const ok = actual[key] >= thresholds[key];
  console.log(`${ok ? 'PASS' : 'FAIL'} ${key}: ${actual[key].toFixed(2)}% (gate >= ${thresholds[key]}%)`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('Coverage gate FAILED. Add tests for the uncovered logic — do not lower the gate to pass.');
  process.exit(1);
}
console.log(`Coverage gate passed (${totals.LF} lines, ${totals.BRF} branches, ${totals.FNF} functions measured).`);
