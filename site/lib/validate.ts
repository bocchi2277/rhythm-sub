import type { Series } from './types';

/**
 * Validate the shape of series.json at load time instead of letting a
 * truncated or corrupt file produce `undefined` fields downstream (which
 * surface as blank cards, wrong links, or a crash in a server component).
 * Throws with the offending index so the bad file is identifiable.
 *
 * Pure (type-only imports) so it can be unit-tested directly via Node's
 * type stripping — see scraper/test/site-validate.test.mjs.
 */
export function assertSeriesShape(value: unknown): asserts value is Series[] {
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
      const e = ep as Record<string, unknown>;
      // The normalization pass dereferences these unconditionally (label.replace,
      // for..of qualities) — a missing field must fail HERE with an identifiable
      // index, not as a bare TypeError deep in the build.
      for (const key of ['slug', 'label'] as const) {
        if (typeof e[key] !== 'string') throw new Error(`series.json[${i}].episodes[${j}].${key} must be a string`);
      }
      if (!Array.isArray(e.qualities)) throw new Error(`series.json[${i}].episodes[${j}].qualities must be an array`);
    });
  });
}
