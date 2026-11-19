import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Pre-build step: emit the search index as a CONTENT-HASHED static JSON under
 * public/search-index/<hash>.json (immutable edge cache), instead of inlining
 * it into every search page's must-revalidate HTML flight payload.
 *
 * The server pages read site/search-index-manifest.json and pass the URL to
 * the client components, which fetch it once; repeat visits and both search
 * pages share the same immutable cache entry.
 *
 * Projection MUST stay in sync with advanced-search/SearchClient.tsx's Item
 * type (search/SearchClient.tsx consumes a subset of the same index).
 */
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(SITE, '..');
const series = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/series.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(SITE, 'img-manifest.json'), 'utf8'));

// Same resolution rule as site/lib/images.ts img() — local assets only.
function img(url) {
  if (!url) return '/placeholder.svg';
  const local = manifest[url];
  if (local) return local;
  if (url.startsWith('/') && !url.startsWith('//') && url[1] !== '\\') return url;
  return '/placeholder.svg';
}

const index = series.map((s) => ({
  slug: s.slug,
  title: s.title,
  alt: (s.altTitles ?? []).join(' '),
  cover: img(s.cover),
  genres: s.genres,
  type: s.type?.text ?? '',
  status: /completed/i.test(s.status ?? '') ? 'مكتمل' : 'مستمر',
  year: s.year,
  season: s.season?.text ?? '',
  rating: s.rating,
  episodesCount: s.episodes.length,
  lastReleaseAt: s.lastReleaseAt
}));

const body = JSON.stringify(index);
const hash = crypto.createHash('sha1').update(body).digest('hex').slice(0, 16);
const dir = path.join(SITE, 'public', 'search-index');
fs.mkdirSync(dir, { recursive: true });
// Content-hash names: drop previous indexes so only the referenced one ships.
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.json')) fs.rmSync(path.join(dir, f));
}
fs.writeFileSync(path.join(dir, `${hash}.json`), body);
fs.writeFileSync(path.join(SITE, 'search-index-manifest.json'), `${JSON.stringify({ url: `/search-index/${hash}.json` }, null, 2)}\n`);
console.log(`search index: ${index.length} items, ${(body.length / 1024).toFixed(0)}KB -> /search-index/${hash}.json`);
