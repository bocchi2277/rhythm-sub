import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Episode, Quality, Series, SitePage } from './types';
import { cleanLabel, cleanTags, safeSynopsis } from './text';
import { getFranchiseKey } from './slug';
import { splitForeignWorks } from './series-split';
import { applyTeamReleases, readTeamReleases } from './team-releases';
import { initSitePages, sitePage as sitePageLookup, mappedHtml as mappedHtmlImpl, getSocials, getCuratedProjectSlugs } from './pages';
import { safeUrl } from './url';

/**
 * Composition root of the site data layer.
 *
 * This module owns the *pipeline* (load → validate → repair → normalize →
 * merge → derive). All the heavy lifting lives in focused sibling modules:
 *
 *   lib/images.ts       manifest lookup + local asset resolution
 *   lib/text.ts         title/synopsis normalization
 *   lib/slug.ts         slug + franchise-key rules
 *   lib/series-split.ts repairs series that absorbed foreign posts
 *   lib/team-releases.ts merges the hand-authored data/releases/*.json
 *   lib/pages.ts        static page loading + sanitization
 *   lib/sanitize.ts     HTML allowlist
 *   lib/url.ts          URL scheme allowlist
 */

// Resolve site/data roots from this module's location (site/lib/ -> site/ -> repo root)
// instead of process.cwd(), which is only correct when the build runs from site/.
const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.resolve(SITE_ROOT, '..', 'data');

export type { Episode, Quality, Series, SitePage };
export { img } from './images';
export { cssUrl } from './css-url';

/**
 * Canonical episode ordering: latest first (highest episode number at the
 * top of the page, episode 1 at the bottom).
 *
 * The scraper uses the same rule (scraper/src/build-model.mjs) — keep the two
 * in sync, otherwise /schedule and /anime/<slug> disagree about what "latest"
 * means.
 */
export function compareEpisodesDesc(a: Episode, b: Episode): number {
  if (a.date && b.date) {
    const dCmp = String(b.date).localeCompare(String(a.date));
    if (dCmp !== 0) return dCmp;
  }
  const numA = a.number ?? 0;
  const numB = b.number ?? 0;
  if (numB !== numA) return numB - numA;
  return String(b.slug).localeCompare(String(a.slug));
}

/**
 * Validate the shape of series.json at load time instead of letting a
 * truncated or corrupt file produce `undefined` fields downstream (which
 * surface as blank cards, wrong links, or a crash in a server component).
 * Throws with the offending index so the bad file is identifiable.
 */
function assertSeriesShape(value: unknown): asserts value is Series[] {
  if (!Array.isArray(value)) throw new Error('series.json must be a JSON array');
  value.forEach((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`series.json[${i}] is not an object`);
    const rec = s as Record<string, unknown>;
    for (const key of ['key', 'slug', 'title'] as const) {
      if (typeof rec[key] !== 'string' || !(rec[key] as string)) {
        throw new Error(`series.json[${i}].${key} must be a non-empty string`);
      }
    }
    if (!Array.isArray(rec.episodes)) throw new Error(`series.json[${i}].episodes must be an array`);
    rec.episodes.forEach((ep, j) => {
      if (!ep || typeof ep !== 'object') throw new Error(`series.json[${i}].episodes[${j}] is not an object`);
    });
  });
}

function loadJson(rel: string): Series[] {
  const file = path.join(DATA_ROOT, rel);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assertSeriesShape(parsed);
    return parsed;
  } catch (e) {
    throw new Error(`Failed to read ${rel}: ${(e as Error).message}`);
  }
}

const raw: Series[] = loadJson('series.json');

// ── Repair series that absorbed posts from a different work ────────────────
const merged = splitForeignWorks(raw);

// ── Normalize every field the UI renders ──────────────────────────────────
function cleanEpisodeText(ep: Episode): void {
  ep.label = cleanLabel(ep.label);
  for (const q of ep.qualities) {
    q.quality = cleanTags(q.quality);
    q.links = (q.links ?? [])
      .map((l) => ({ name: cleanTags(l.name), url: safeUrl(l.url) ?? '' }))
      // Drop links with missing/unsafe schemes (e.g. javascript: from a
      // compromised upstream or a malformed team release) — every href the
      // site renders comes from here.
      .filter((l) => l.name && l.url);
  }
}

/** Guarantee that episode slugs are unique inside a series (React keys). */
function ensureUniqueEpisodeSlugs(episodes: Episode[]): void {
  const seen = new Set<string>();
  for (const ep of episodes) {
    let slug = ep.slug || 'episode';
    let n = 2;
    while (seen.has(slug)) slug = `${ep.slug}-${n++}`;
    seen.add(slug);
    ep.slug = slug;
  }
}

for (const s of merged) {
  s.synopsis = safeSynopsis(s.synopsis);

  const cleanedStaff: Record<string, string[]> = {};
  for (const [rawRole, names] of Object.entries(s.staff ?? {})) {
    const role = rawRole.trim();
    if (/^(https?|ftp|www|anime\s*info|http)$/i.test(role) || /[:/.\\]/.test(role)) continue;
    const validNames = (names ?? [])
      .map((n) => String(n).trim())
      .filter((n) => n && !/^(https?:|\/\/|www\.)/i.test(n) && !/twitter\.com|t\.me|discord/i.test(n) && n.length <= 90);
    if (validNames.length > 0) cleanedStaff[role] = validNames;
  }
  s.staff = cleanedStaff;

  for (const e of s.episodes) {
    const strippedLabel = e.label.replace(/\[[^\]]*\]/g, '').trim();
    if (!strippedLabel && s.title) {
      const m = e.slug.match(/-(\d{1,4})(?:-end)?$/);
      if (m) e.label = `${s.title} - ${parseInt(m[1], 10)}`;
    }
    e.contentImages = e.contentImages ?? [];
    const distinct = e.contentImages.find((u) => u && u !== e.cover && !/\.svg$/i.test(u) && !/icons8|download-from-cloud/i.test(u));
    e.cardImage = distinct ?? e.cover ?? null;
    cleanEpisodeText(e);
  }

  ensureUniqueEpisodeSlugs(s.episodes);
  s.episodes.sort(compareEpisodesDesc);
}

// ── Merge the hand-authored team releases ─────────────────────────────────
applyTeamReleases(merged, readTeamReleases(DATA_ROOT), compareEpisodesDesc);

// Re-run the uniqueness pass: a manual release slug ("<series>-<epNo>") can
// collide with a scraped episode slug.
for (const s of merged) {
  ensureUniqueEpisodeSlugs(s.episodes);
  s.episodes.sort(compareEpisodesDesc);
}

export const allSeries: Series[] = merged;

// ── Derived collections ────────────────────────────────────────────────────
const familyMap = new Map<string, Series[]>();
for (const s of merged) {
  const key = getFranchiseKey(s.slug);
  if (key) {
    const bucket = familyMap.get(key);
    if (bucket) bucket.push(s);
    else familyMap.set(key, [s]);
  }
}

export const franchises: { name: string; works: Series[] }[] = [...familyMap.entries()]
  .filter(([, works]) => works.length > 1)
  .map(([, works]) => {
    const sorted = [...works].sort((a, b) => a.title.length - b.title.length);
    const words = sorted[0].title.replace(/[:–-].*$/, '').trim();
    const seenCovers = new Set<string>();
    const distinctWorks = works.filter((w) => {
      if (w.cover && seenCovers.has(w.cover)) return false;
      if (w.cover) seenCovers.add(w.cover);
      return true;
    });
    return { name: words || sorted[0].title, works: distinctWorks.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)) };
  })
  .sort((a, b) => b.works.length - a.works.length);

// ── Static pages ──────────────────────────────────────────────────────────
initSitePages(DATA_ROOT);

export function sitePage(key: string): SitePage | null {
  return sitePageLookup(key);
}

export function mappedHtml(html: string): string {
  return mappedHtmlImpl(html);
}

export const socials: { href: string; label: string }[] = getSocials();

const bySlugMap = new Map(allSeries.map((s) => [s.slug, s]));
const byKeyMap = new Map(allSeries.map((s) => [s.key, s]));

export const currentProjects: Series[] = getCuratedProjectSlugs().length
  ? getCuratedProjectSlugs()
      .map((sl) => bySlugMap.get(sl))
      .filter((s): s is Series => Boolean(s))
  : allSeries
      .filter((s) => /ongoing/i.test(s.status ?? ''))
      .filter((s) => {
        if (!s.lastReleaseAt) return false;
        const age = Date.now() - new Date(s.lastReleaseAt).getTime();
        return age >= 0 && age < 30 * 24 * 3600 * 1000;
      })
      .sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));

export const latestReleases = allSeries
  .flatMap((s) => s.episodes.map((e) => ({ series: s, ep: e })))
  .sort((a, b) => {
    const dateCmp = String(b.ep.date ?? '').localeCompare(String(a.ep.date ?? ''));
    if (dateCmp !== 0) return dateCmp;
    const numA = a.ep.number ?? 0;
    const numB = b.ep.number ?? 0;
    if (numB !== numA) return numB - numA;
    return String(b.ep.slug).localeCompare(String(a.ep.slug));
  });

export function formatWorksCount(count: number): string {
  if (count === 1) return 'عمل واحد';
  if (count === 2) return 'عملان';
  if (count >= 3 && count <= 10) return `${count} أعمال`;
  return `${count} عمل`;
}

export function bySlug(slug: string): Series | undefined {
  return bySlugMap.get(slug);
}

export function byKey(key: string): Series | undefined {
  return byKeyMap.get(key);
}
