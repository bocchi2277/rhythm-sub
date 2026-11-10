/**
 * Slug helpers shared by the site data layer.
 *
 * NOTE: the scraper keeps an independent copy of `asciiSlug` / `normalizeSlug`
 * in `scraper/src/build-model.mjs`. The two MUST stay in sync — they encode
 * the same "post slug → series slug" contract, and a divergence silently
 * splits one series into two on the site.
 */

/** Generic title prefixes that are too common to identify a franchise. */
export const GENERIC_PREFIXES = new Set([
  'yuusha', 'princess', 'isekai', 'mahou', 'shin', 'super', 'strike', 'kono',
  'seishun', 'ore', 'watashi', 'boku', 'toaru', 'gekijouban'
]);

/**
 * Lowercase, ASCII-only slug. Arabic titles slugify to '' — callers must
 * handle that (see `slugifySeries`).
 */
export function asciiSlug(raw: string): string {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding: keep the raw string and let the slugifier strip it.
  }
  s = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'anime';
}

/** Drop a trailing episode/volume suffix from a post slug. */
export function normalizeSlug(slug: string): string {
  return slug
    .replace(/-(?:episode|ep)-?\d{1,4}$/i, '')
    .replace(/-\d{1,4}$/, '')
    .replace(/-\d{1,4}(?:-\d{1,2})?$/, '');
}

/** ASCII slug for a human title. Returns '' for titles with no ASCII word. */
export function slugifySeries(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Franchise key for a series slug: the first two slug words, or the first
 * three when the first word is a generic prefix ("kono" → "kono-sekai-ni").
 */
export function getFranchiseKey(slug: string): string | null {
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
