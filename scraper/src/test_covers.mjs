import fs from 'node:fs';
import path from 'node:path';

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'series.json'), 'utf8'));

console.log('=== Checking duplicate covers ===');

const GENERIC_PREFIXES = new Set(['yuusha', 'princess', 'isekai', 'mahou', 'shin', 'super', 'strike', 'kono', 'seishun', 'ore', 'watashi', 'boku', 'toaru', 'gekijouban']);

function getFranchiseKey(slug) {
  const parts = slug.split('-').filter(Boolean);
  if (parts.length >= 2) {
    const two = parts.slice(0, 2).join('-');
    if (!GENERIC_PREFIXES.has(parts[0]) || parts.length >= 3) {
      if (GENERIC_PREFIXES.has(parts[0])) return parts.slice(0, 3).join('-');
      return two;
    }
  }
  return null;
}

const familyMap = new Map();
for (const s of raw) {
  const key = getFranchiseKey(s.slug);
  if (key) {
    if (!familyMap.has(key)) familyMap.set(key, []);
    familyMap.get(key).push(s);
  }
}

for (const [k, works] of familyMap) {
  if (works.length > 1) {
    const covers = new Map();
    const dups = [];
    for (const w of works) {
      if (covers.has(w.cover)) {
        dups.push({ w, prev: covers.get(w.cover) });
      } else {
        covers.set(w.cover, w);
      }
    }
    if (dups.length > 0) {
      console.log(`\nFranchise [${k}] has ${dups.length} duplicate cover entries:`);
      for (const d of dups) {
        console.log(`   - "${d.w.title}" (${d.w.slug}) shares cover with "${d.prev.title}" (${d.prev.slug})`);
        console.log(`     cover: ${d.w.cover}`);
        console.log(`     d.w contentImages:`, d.w.episodes.flatMap(e => e.contentImages));
      }
    }
  }
}
