import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATA, POSTS_DIR, writeFileAtomic, writeJsonAtomic } from './util.mjs';
import {
  asciiSlug,
  normalizeSlug,
  getFranchiseKey,
  cleanSynopsis,
  compareEpisodesDesc,
  cleanStaffRecord
} from '../../shared/rules.mjs';

// The boundary rules now live in ONE place (shared/rules.mjs), imported by
// both the scraper and the site. Re-exported here because existing consumers
// and the parity tests import them from build-model.
export { asciiSlug, normalizeSlug, getFranchiseKey, cleanSynopsis, compareEpisodesDesc, cleanStaffRecord };

export function episodeNumberFrom(post) {
  const m1 = post.slug.match(/(?:^|-)(?:episode|ep)-?(\d{1,4})$/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = post.slug.match(/-(\d{1,4})$/);
  if (m2 && !/(?:bd|tv|dvd|v2)$/i.test(post.slug.replace(/-(?:episode|ep)-?\d{1,4}$/i, ''))) {
    const base = post.slug.slice(0, m2.index);
    if (!/(^|-)(?:bd|tv|dvd)$/.test(base)) return parseInt(m2[1], 10);
  }
  const t = post.title.match(/[-#\s](\d{1,4})(?:\s*(?:END|الأخيرة|\(نهائي\)))?$/i);
  if (t && post.type?.text !== 'Movie') return parseInt(t[1], 10);
  return null;
}

// Declared once at module scope (previously re-created inside the per-series
// loop). Pure function of `post`.
export function extractEpisodeMetadata(post) {
  const title = post.title || '';

  // Check if range like '01 ~ 05' or '[01~12]'
  const tildeMatch = title.match(/(\d{1,3})\s*[\~～]\s*(\d{1,3})(?:\s*END)?/i) || title.match(/\[(\d{1,3})\s*[\~～–-]\s*(\d{1,3})\]/);
  if (tildeMatch) {
    const isEnd = /END/i.test(title);
    return {
      displayNum: isEnd ? `${tildeMatch[1]}~${tildeMatch[2]} END` : `${tildeMatch[1]}~${tildeMatch[2]}`,
      number: parseInt(tildeMatch[2], 10),
      label: title
    };
  }

  // Check if volume like 'Vol.01' or 'Vol.1'
  const volMatch = title.match(/Vol\.?\s*(\d{1,2})(?:\s*END)?/i);
  if (volMatch) {
    const isEnd = /END/i.test(title);
    return {
      displayNum: isEnd ? `Vol.${volMatch[1]} END` : `Vol.${volMatch[1]}`,
      number: parseInt(volMatch[1], 10) * 100,
      label: title
    };
  }

  // Check if full BD batch like 'Absolute Duo - BD' or 'BD'
  if (/\bBD\b|Blu-ray/i.test(post.type?.text) || (/\bBD\b|Blu-ray/i.test(title) && !title.match(/[-–]\s*\d{1,3}\s*$/))) {
    return {
      displayNum: 'BD',
      number: 9999,
      label: title
    };
  }

  // Check Movie / OVA / ONA / Special
  if (/movie|فيلم/i.test(title) || post.type?.text === 'Movie') {
    return { displayNum: 'فيلم', number: 1, label: title };
  }
  if (/OVA/i.test(title) || post.type?.text === 'OVA') {
    const ovaNum = title.match(/OVA\s*(\d+)/i);
    return { displayNum: ovaNum ? `OVA ${ovaNum[1]}` : 'OVA', number: ovaNum ? parseInt(ovaNum[1], 10) : 1, label: title };
  }
  if (/ONA/i.test(title) || post.type?.text === 'ONA') {
    const onaNum = title.match(/[-–]\s*(\d+)/);
    return { displayNum: onaNum ? `ONA ${onaNum[1]}` : 'ONA', number: onaNum ? parseInt(onaNum[1], 10) : 1, label: title };
  }

  // Single episode
  const epNum = episodeNumberFrom(post);
  if (epNum != null) {
    const isEnd = /END|الأخيرة/i.test(title);
    return {
      displayNum: isEnd ? `${epNum} END` : String(epNum),
      number: epNum,
      label: title
    };
  }

  return { displayNum: null, number: null, label: title };
}

function pickLatest(posts, getter) {
  for (const p of posts) {
    const v = getter(p);
    if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) return v;
  }
  return null;
}

// Per-record staff cleaning and episode ordering now live in shared/rules.mjs
// (imported + re-exported at the top of this file).

// Declared once at module scope (previously re-created inside the per-series
// loop).
const COVER_OVERRIDES = {
  'high-school-dxd-ova': 'https://rhythm-sub.com/wp-content/uploads/2020/01/94594db3230322d9f735cde56495f6a9.jpg',
};

// Title words that carry no franchise signal.
const STOPWORDS = new Set([
  'anime', 'season', 'the', 'movie', 'ova', 'vol', 'part', 'shounen', 'shoujo',
  'isekai', 'yuusha', 'tame', 'kamo', 'danshi', 'koukou', 'gakkou', 'tokubetsu',
  'hen', 'kara', 'shin', 'ore', 'boku', 'watashi', 'uchi', 'kono', 'sono', 'ano',
  'shikashitara', 'special', 'specials', 'blu', 'ray', 'dvd', 'film'
]);

function areDistinctlyRelated(titleA, titleB) {
  const wordsA = (titleA || '').toLowerCase().split(/\W+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const wordsB = (titleB || '').toLowerCase().split(/\W+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return wordsA.some((w) => wordsB.includes(w));
}

// Group posts into series. Pure and exported for regression tests.
// Pass 1: key each post by MAL id when present, else by normalized slug; a MAL
// post absorbs any slug group that already exists.
// Pass 2 (deterministic fix): a MAL post may arrive BEFORE its non-MAL
// siblings, so pass 1 alone would leave a duplicate slug-only series behind.
// After all posts are keyed, merge every slug group matching a MAL group's
// member slugs into that MAL group. Iteration order is the Map insertion
// order (posts are date-sorted), so the result is deterministic.
export function groupPosts(posts) {
  const groups = new Map();
  for (const p of posts) {
    const malIdMatch = p.malUrl ? p.malUrl.match(/\/anime\/(\d+)/) : null;
    const key = malIdMatch ? `mal:${malIdMatch[1]}` : `slug:${normalizeSlug(p.slug)}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);

    if (malIdMatch) {
      const slugKey = `slug:${normalizeSlug(p.slug)}`;
      if (groups.has(slugKey)) {
        groups.get(key).push(...groups.get(slugKey));
        groups.delete(slugKey);
      }
    }
  }

  for (const [key, members] of groups) {
    if (!key.startsWith('mal:')) continue;
    for (const p of [...members]) {
      const slugKey = `slug:${normalizeSlug(p.slug)}`;
      const slugGroup = groups.get(slugKey);
      if (slugGroup) {
        members.push(...slugGroup);
        groups.delete(slugKey);
      }
    }
  }
  return groups;
}

// Shape guard for a parsed post file. The CI snapshot check only JSON.parse-es
// each file, so a structurally wrong post (valid JSON, missing downloads) must
// be rejected HERE with its filename, not crash later as a bare TypeError on
// p.downloads.flatMap. Pure + exported for regression tests.
export function isValidPost(p) {
  return Boolean(
    p && typeof p === 'object' &&
    typeof p.slug === 'string' &&
    typeof p.title === 'string' &&
    Array.isArray(p.downloads)
  );
}

function main() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.json'));
  const posts = [];
  const bad = [];
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8'));
      // Shape, not just syntax: the CI snapshot guard only JSON.parse-es each
      // file, so a structurally wrong post (valid JSON, missing downloads)
      // would otherwise crash later as a bare TypeError on p.downloads.flatMap.
      if (!isValidPost(p)) {
        bad.push(`${f}: invalid post shape (need string slug/title and a downloads array)`);
        continue;
      }
      posts.push(p);
    } catch (e) {
      bad.push(`${f}: ${e.message}`);
    }
  }
  if (bad.length) {
    // Fail loudly with the offending file names instead of a bare SyntaxError
    // deep in the build (or silently dropping series from the model).
    throw new Error(`Unusable post files:\n  ${bad.join('\n  ')}`);
  }
  console.log(`loaded ${posts.length} posts`);

  const seriesList = assembleSeries(posts);

  writeJsonAtomic(path.join(DATA, 'series.json'), seriesList, 0);

  const { markdown, totalEpisodes, uniqueImages } = buildReport(seriesList, posts.length, files.length, new Date().toISOString());
  writeFileAtomic(path.join(DATA, 'report.md'), markdown);
  console.log(`series: ${seriesList.length} | episodes: ${totalEpisodes} | images: ${uniqueImages}`);
  console.log(markdown);
}

// Pure assembly pipeline: posts in → series out (no fs, no clock). Extracted
// verbatim from main() so the grouping/slug/related/cover rules are unit-testable
// (test/build-model-assembly.test.mjs). main() keeps all I/O.
export function assembleSeries(posts) {
  posts.sort((a, b) => String(a.publishedAt ?? '').localeCompare(String(b.publishedAt ?? '')));

  const groups = groupPosts(posts);

  const seriesList = [];
  const slugIndex = new Map();
  const usedSlugs = new Set();

  // NOTE: the loop variable must NOT be named `groupPosts` — that would
  // shadow the exported grouping function of the same name.
  for (const [, members] of groups) {
    members.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
    const newest = members[0];

    const seenSlugs = new Set();
    const uniq = [];
    for (const p of members) {
      if (!seenSlugs.has(p.slug)) {
        seenSlugs.add(p.slug);
        uniq.push(p);
      }
    }

    let slug = asciiSlug(normalizeSlug(newest.slug));
    if (usedSlugs.has(slug)) {
      if (newest.year && !usedSlugs.has(`${slug}-${newest.year}`)) slug = `${slug}-${newest.year}`;
      else {
        let n = 2;
        while (usedSlugs.has(`${slug}-${n}`)) n++;
        slug = `${slug}-${n}`;
      }
    }
    usedSlugs.add(slug);

    const episodes = uniq.map((p) => {
      const meta = extractEpisodeMetadata(p);
      // Trimmed contract: only fields the site renders (the full post stays
      // in data/posts/*.json). Episode-level url/rating/synopsis/trailer/
      // postId/author were measured unrendered — 13.4% dead weight, removed.
      return {
        slug: p.slug,
        number: meta.number,
        displayNum: meta.displayNum,
        label: meta.label,
        date: p.publishedAt,
        cover: p.cover,
        qualities: p.downloads.flatMap((d) =>
          d.qualities.map((q) => ({ quality: q.quality, links: q.links }))
        ),
        contentImages: p.contentImages
      };
    });

    episodes.sort(compareEpisodesDesc);

    const staff = {};
    for (const p of uniq) {
      for (const [role, validNames] of Object.entries(cleanStaffRecord(p.staff))) {
        staff[role] = staff[role] ?? [];
        for (const n of validNames) if (!staff[role].includes(n)) staff[role].push(n);
      }
    }

    const guideUrls = [...new Set(uniq.flatMap((p) => (p.seriesGuide ?? []).map((g) => g.url)))];

    const series = {
      key: newest.malUrl ? `mal:${newest.malUrl}` : `slug:${asciiSlug(normalizeSlug(newest.slug))}`,
      slug,
      title: (newest.title ?? '').replace(/\s*[-–]\s*\d{1,4}\s*$/, '').trim() || newest.title,
      altTitles: pickLatest(uniq, (p) => p.altTitles),
      cover: COVER_OVERRIDES[slug] ?? pickLatest(uniq, (p) => p.cover),
      genres: pickLatest(uniq, (p) => p.genres) ?? [],
      status: pickLatest(uniq, (p) => p.status),
      studio: pickLatest(uniq, (p) => p.studio),
      year: pickLatest(uniq, (p) => p.year),
      season: pickLatest(uniq, (p) => p.season),
      type: pickLatest(uniq, (p) => p.type),
      episodesCount: pickLatest(uniq, (p) => p.episodesCount),
      rating: pickLatest(uniq, (p) => p.rating),
      synopsis: cleanSynopsis(pickLatest(uniq, (p) => p.synopsis)),
      trailerYoutubeId: pickLatest(uniq, (p) => p.trailerYoutubeId),
      staff,
      seriesGuideUrls: guideUrls,
      lastReleaseAt: newest.publishedAt,
      episodes
    };

    seriesList.push(series);
    for (const p of uniq) slugIndex.set(asciiSlug(normalizeSlug(p.slug)), series.key);
  }

  const franchiseMap = new Map();
  for (const s of seriesList) {
    const key = getFranchiseKey(s.slug);
    if (key) {
      if (!franchiseMap.has(key)) franchiseMap.set(key, []);
      franchiseMap.get(key).push(s.key);
    }
  }

  const seriesByKey = new Map(seriesList.map((s) => [s.key, s]));

  for (const s of seriesList) {
    const fromGuides = [...new Set(s.seriesGuideUrls.map((u) => u.replace(/\/+$/, '').split('/').pop()).filter(Boolean))]
      .map((sl) => slugIndex.get(asciiSlug(normalizeSlug(sl))))
      .filter((k) => k && k !== s.key);
    const fKey = getFranchiseKey(s.slug);
    const family = fKey ? (franchiseMap.get(fKey) ?? []).filter((k) => k !== s.key) : [];
    const candidates = [...new Set([...fromGuides, ...family])];

    s.relatedSeries = candidates
      .filter((k) => {
        const other = seriesByKey.get(k);
        if (!other) return false;
        return areDistinctlyRelated(s.title, other.title);
      })
      .slice(0, 8);
    delete s.seriesGuideUrls;
  }

  // Resolve duplicate covers across series in the same franchise
  const seenCovers = new Map();
  for (const s of seriesList) {
    if (!s.cover) continue;
    if (seenCovers.has(s.cover)) {
      const allImages = s.episodes.flatMap((e) => e.contentImages ?? []);
      const altImg = allImages.find((u) => u && !seenCovers.has(u) && !/icons8|download-from-cloud/i.test(u) && !/\.svg$/i.test(u) && !/background|gif/i.test(u));
      if (altImg) {
        s.cover = altImg;
        seenCovers.set(altImg, s.slug);
      }
    } else {
      seenCovers.set(s.cover, s.slug);
    }
  }

  seriesList.sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));
  return seriesList;
}

// Pure report builder. The timestamp is injected (main() passes the real
// clock) so tests are deterministic. Returns the markdown plus the counters
// main() logs.
export function buildReport(seriesList, postsLoaded, filesTotal, generatedAt) {
  const totalEpisodes = seriesList.reduce((n, s) => n + s.episodes.length, 0);
  const withCover = seriesList.filter((s) => s.cover).length;
  const withSynopsis = seriesList.filter((s) => s.synopsis).length;
  const withRating = seriesList.filter((s) => s.rating != null).length;
  const withStaff = seriesList.filter((s) => Object.keys(s.staff).length).length;
  const withDownloads = seriesList.filter((s) => s.episodes.some((e) => e.qualities.length)).length;
  const multiEp = seriesList.filter((s) => s.episodes.length > 1).length;
  const withRelated = seriesList.filter((s) => s.relatedSeries?.length).length;

  const allImageUrls = new Set();
  for (const s of seriesList) {
    if (s.cover) allImageUrls.add(s.cover);
    for (const e of s.episodes) for (const im of e.contentImages ?? []) allImageUrls.add(im);
  }

  const report = `# Rhythm-Sub scrape & model report
Generated: ${generatedAt}

## Totals
- Source posts loaded: **${postsLoaded} / ${filesTotal}** (unusable files fail the build)
- Series entities: **${seriesList.length}**
- Episode/release entries: **${totalEpisodes}**
- Series with >1 release: ${multiEp}
- Unique images referenced: **${allImageUrls.size}**

## Field coverage (series level)
| Field | Coverage |
|---|---|
| cover | ${withCover}/${seriesList.length} |
| synopsis | ${withSynopsis}/${seriesList.length} |
| rating | ${withRating}/${seriesList.length} |
| staff | ${withStaff}/${seriesList.length} |
| downloads | ${withDownloads}/${seriesList.length} |
| relatedSeries (franchise links) | ${withRelated}/${seriesList.length} |

## Sample verification (5 random series)
${seriesList
  .filter((_, i) => i % Math.max(1, Math.floor(seriesList.length / 5)) === 0)
  .slice(0, 5)
  .map(
    (s) =>
      `- **${s.title}** (${s.year ?? '?'}, ${s.type?.text ?? '?'}), eps:${s.episodes.length}, genres:[${s.genres.slice(0, 3).join(',')}]`
  )
  .join('\n')}
`;

  return { markdown: report, totalEpisodes, uniqueImages: allImageUrls.size };
}

// CLI direct run — importing this module must not rebuild the model as a side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
