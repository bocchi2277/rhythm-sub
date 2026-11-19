/**
 * Slug helpers — re-exported from the shared boundary contract
 * (shared/rules.mjs), the SINGLE source of truth also imported by the
 * scraper (scraper/src/build-model.mjs). A divergence used to silently split
 * one series into two on the site; consolidation removed that failure mode.
 *
 * slugifySeries is site-only (human title → slug for synthetic series).
 */
export { asciiSlug, normalizeSlug, getFranchiseKey, GENERIC_PREFIXES } from '../../shared/rules.mjs';

/** ASCII slug for a human title. Returns '' for titles with no ASCII word. */
export function slugifySeries(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
