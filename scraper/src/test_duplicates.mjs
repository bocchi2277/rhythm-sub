import fs from 'node:fs';
import path from 'node:path';

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'series.json'), 'utf8'));

console.log('=== Checking series with identical normalized titles or identical covers ===');

const titleMap = new Map();
for (const s of raw) {
  const normTitle = s.title.toLowerCase().replace(/[\s\-_:–!★☆\[\]]+/g, ' ').replace(/\s*(?:bd|tv|dvd|vol\.?\s*\d+.*)$/i, '').trim();
  if (!titleMap.has(normTitle)) titleMap.set(normTitle, []);
  titleMap.get(normTitle).push(s);
}

for (const [t, list] of titleMap) {
  if (list.length > 1) {
    console.log(`\nNormTitle: "${t}" (${list.length} entries):`);
    for (const s of list) {
      console.log(`   - [${s.slug}] "${s.title}" (eps: ${s.episodes.length}, year: ${s.year}, cover: ${s.cover ? s.cover.split('/').pop() : 'none'})`);
    }
  }
}
