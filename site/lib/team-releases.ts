import fs from 'node:fs';
import path from 'node:path';
import type { Quality, Series } from './types';
import { cleanTags } from './text';
import { slugifySeries } from './slug';
import { safeUrl } from './url';

/**
 * Manual ("team") releases authored under `data/releases/*.json`.
 *
 * Each file describes one release and is merged into the matching series at
 * build time. Files are authored by hand, so they are validated strictly: a
 * malformed file fails the build loudly rather than producing a broken page.
 */

export type TeamReleaseFile = { file: string; value: Record<string, unknown> };

export function readTeamReleases(dataRoot: string): TeamReleaseFile[] {
  const dir = path.join(dataRoot, 'releases');
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`Failed to read data/releases: ${(e as Error).message}`);
  }
  return entries
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((file) => {
      try {
        const value = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('expected a JSON object');
        }
        return { file, value };
      } catch (e) {
        throw new Error(`Invalid data/releases/${file}: ${(e as Error).message}`);
      }
    });
}

export function normalizeTeamQualities(input: unknown, file: string): Quality[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error(`data/releases/${file}: qualities must be an array`);
  return input.map((q, qi) => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      throw new Error(`data/releases/${file}: qualities[${qi}] must be an object`);
    }
    const quality = typeof q.quality === 'string' ? cleanTags(q.quality) : '';
    if (!quality) throw new Error(`data/releases/${file}: qualities[${qi}].quality is required`);
    if (!Array.isArray(q.links)) throw new Error(`data/releases/${file}: qualities[${qi}].links must be an array`);
    const links = q.links.map((l: unknown, li: number) => {
      if (!l || typeof l !== 'object' || Array.isArray(l)) {
        throw new Error(`data/releases/${file}: qualities[${qi}].links[${li}] must be an object`);
      }
      const link = l as Record<string, unknown>;
      const name = typeof link.name === 'string' ? cleanTags(link.name) : '';
      const url = safeUrl(typeof link.url === 'string' ? link.url : null);
      if (!name || !url) {
        throw new Error(`data/releases/${file}: qualities[${qi}].links[${li}] needs a name and a safe URL`);
      }
      return { name, url };
    });
    return { quality, links };
  });
}

/**
 * Merge the manual releases into the scraped series list.
 *
 * `allSeries` is mutated in place: matching series receive the new episode,
 * unknown series are appended as a synthetic "team" series.
 */
export function applyTeamReleases(
  allSeries: Series[],
  teamReleases: TeamReleaseFile[],
  episodeSorter: (a: Series['episodes'][number], b: Series['episodes'][number]) => number
): void {
  // O(1) lookup instead of a linear scan per release file.
  const bySlug = new Map(allSeries.map((s) => [s.slug, s]));

  for (const [idx, { file, value: r }] of teamReleases.entries()) {
    const rawSlug = String(r.seriesSlug ?? '').trim();
    // Arabic-only titles slugify to '' — skip instead of silently dropping
    // via a Date.now() fallback that collides on every render.
    const slug = rawSlug || slugifySeries(String(r.seriesTitle ?? ''));
    if (!slug) continue;

    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!label) throw new Error(`data/releases/${file}: label is required`);
    if (r.episodeNumber != null && !Number.isFinite(Number(r.episodeNumber))) {
      throw new Error(`data/releases/${file}: episodeNumber must be numeric`);
    }
    const epNum = r.episodeNumber != null ? Number(r.episodeNumber) : null;

    let s = bySlug.get(slug);
    if (!s) {
      const y = r.date ? Number(String(r.date).slice(0, 4)) : NaN;
      s = {
        key: `team:${slug}`,
        malUrl: null,
        slug,
        title: String(r.seriesTitle ?? slug),
        altTitles: null,
        cover: null,
        genres: [],
        status: 'Ongoing',
        studio: null,
        year: Number.isFinite(y) && y > 0 ? y : null,
        season: null,
        type: { text: 'TV', slug: 'tv' },
        episodesCount: null,
        rating: null,
        synopsis: '',
        trailerYoutubeId: null,
        staff: {},
        relatedSeries: [],
        lastReleaseAt: null,
        episodes: []
      };
      allSeries.push(s);
      bySlug.set(slug, s);
    }

    const dateStr = r.date == null ? null : String(r.date);
    const isoDate = dateStr ? (dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00+03:00`) : null;
    if (isoDate && Number.isNaN(Date.parse(isoDate))) {
      throw new Error(`data/releases/${file}: date is not parseable`);
    }

    s.episodes.push({
      slug: `${slug}-${epNum ?? `team-${idx}`}`,
      url: `/anime/${slug}/`,
      number: epNum,
      displayNum: epNum != null ? String(epNum) : null,
      label,
      date: isoDate,
      rating: null,
      cover: typeof r.coverUrl === 'string' && r.coverUrl.startsWith('/img/') ? r.coverUrl : null,
      synopsis: String(r.synopsis ?? ''),
      trailerYoutubeId: null,
      qualities: normalizeTeamQualities(r.qualities, file),
      contentImages: [],
      postId: null,
      author: 'team'
    });

    if (r.staff != null) {
      if (typeof r.staff !== 'object' || Array.isArray(r.staff)) {
        throw new Error(`data/releases/${file}: staff must be an object`);
      }
      for (const [role, names] of Object.entries(r.staff)) {
        if (!Array.isArray(names)) throw new Error(`data/releases/${file}: staff.${role} must be an array`);
        const validNames = names.map((n) => String(n).trim()).filter(Boolean);
        s.staff[role] = [...new Set([...(s.staff[role] ?? []), ...validNames])];
      }
    }

    // Keep descending (latest first) — matches the canonical episode sort.
    s.episodes.sort(episodeSorter);
  }
}
