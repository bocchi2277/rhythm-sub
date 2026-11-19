/**
 * Pure text-normalization helpers for scraped release titles.
 *
 * These encode a pile of upstream-specific rules (hash tags, batch ranges,
 * Arabic greeting/chatter prefixes). They are kept free of I/O so they can be
 * unit-tested and reused by both the data layer and the components.
 */

/**
 * Strip scraper noise from a title/label:
 *  - [HEXHASH] groups (e.g. "[CC80CD66]")
 *  - leftover empty groups ("[]")
 *  - doubled opening brackets ("[CC80CD66][[VHS 1080p AAC]" → "VHS 1080p AAC")
 *  - a fully-wrapping outer pair ("[720p AAC]" → "720p AAC")
 *
 * Meaningful tags ([HARD-SUB], [01~04]) are preserved. Must run AFTER
 * batch-split detection, which needs the raw hashes.
 */
export function cleanTags(input: string): string {
  let s = input.replace(/\[[0-9A-Fa-f]{6,12}\]/g, ' ');
  s = s.replace(/\[\s*\]/g, ' ');
  while (/\[\[/.test(s)) s = s.replace(/\[\[/g, '[');
  s = s.trim();
  const wrapped = s.match(/^\[([^[\]]+)\]$/);
  if (wrapped) s = wrapped[1];
  return s.replace(/\s{2,}/g, ' ').trim();
}

/** cleanTags + drop the trailing "LEAKED" marker. */
export function cleanLabel(input: string): string {
  return cleanTags(input)
    .replace(/\s*LEAKED\s*$/i, '')
    .trim();
}

/** Lowercased word tokens (3+ chars) used to compare work titles. */
export function tokenizeWork(t: string): string[] {
  return t.toLowerCase().match(/[a-z0-9\u0600-\u06FF]{3,}/g) ?? [];
}

/** Strip a trailing episode/volume token from a work title ("Show - 05" → "Show"). */
export function workStem(t: string): string {
  let l = String(t).trim();
  let prev: string | null = null;
  while (prev !== l) {
    prev = l;
    l = l.replace(/(\s*[-~]\s*)(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
    l = l.replace(/\s+(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
    l = l.replace(/[\s\-~]+$/, '');
  }
  return l.trim();
}

/**
 * Case-preserving title for a stem: drop the trailing episode/vol token
 * (with or without a dash: "Show - 05" and "Show Vol.02" both reduce to "Show").
 */
export function workTitle(t: string): string {
  return t
    .replace(/(\s*[-~]\s*)(?:Vol\.?\s*)?\d{1,4}(\s*(?:END|الأخيرة)?)?\s*$/i, '')
    .replace(/\s+(?:Vol\.?\s*)?\d{1,4}(\s*(?:END|الأخيرة)?)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Synopsis cleaning + staff cleaning are the shared boundary contract
// (shared/rules.mjs) — the scraper imports the SAME implementation, so the
// two can no longer drift. safeSynopsis is the historical site-side name.
export { cleanSynopsis as safeSynopsis, cleanStaffRecord } from '../../shared/rules.mjs';
