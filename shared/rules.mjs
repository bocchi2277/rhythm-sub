/**
 * Shared domain rules — the SINGLE source of truth for the scraper/site
 * boundary. Both packages import this module (scraper: native ESM; site:
 * bundler resolution + adjacent rules.d.mts for TypeScript).
 *
 * These rules previously lived in duplicate copies
 * (scraper/src/build-model.mjs ↔ site/lib/{slug,text,episodes}.ts) and
 * drifted once in production. The parity test
 * (scraper/test/series-rules.test.mjs) now guards the wiring.
 *
 * Pure: no I/O, no dependencies. Keep it that way.
 */

/** Generic title prefixes that are too common to identify a franchise. */
export const GENERIC_PREFIXES = new Set([
  'yuusha', 'princess', 'isekai', 'mahou', 'shin', 'super', 'strike', 'kono',
  'seishun', 'ore', 'watashi', 'boku', 'toaru', 'gekijouban'
]);

/** Lowercase, ASCII-only slug. Arabic titles slugify to 'anime' fallback. */
export function asciiSlug(raw) {
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
export function normalizeSlug(slug) {
  return slug
    .replace(/-(?:episode|ep)-?\d{1,4}$/i, '')
    .replace(/-\d{1,4}$/, '')
    .replace(/-\d{1,4}(?:-\d{1,2})?$/, '');
}

/**
 * Franchise key for a series slug: the first two slug words, or the first
 * three when the first word is a generic prefix ("kono" → "kono-sekai-ni").
 */
export function getFranchiseKey(slug) {
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

/** A staff role that is really a URL/label, or contains separator chars. */
export function isInvalidRole(role) {
  return /^(https?|ftp|www|anime\s*info|http)$/i.test(role) || /[:/.\\]/.test(role);
}

/**
 * Clean a merged staff record: drop URL-like/malformed roles and names that
 * are links or over-long. Used by the scraper (per post, then merge-dedupe)
 * and the site (on the merged record).
 */
export function cleanStaffRecord(staff) {
  const cleaned = {};
  for (const [rawRole, names] of Object.entries(staff ?? {})) {
    const role = rawRole.trim();
    if (isInvalidRole(role)) continue;
    const validNames = (names ?? [])
      .map((n) => String(n).trim())
      .filter((n) => n && !/^(https?:|\/\/|www\.)/i.test(n) && !/twitter\.com|t\.me|discord/i.test(n) && n.length <= 90);
    if (validNames.length > 0) cleaned[role] = validNames;
  }
  return cleaned;
}

/**
 * Normalize a scraped synopsis: strip the "قصة الأنمي:" prefix, drop
 * greeting/announcement paragraphs and pure metadata blocks, and reject
 * chatter that is not an actual plot summary.
 *
 * NOTE: the greeting alternatives use a SINGLE [^\n]* quantifier before \n+.
 * An earlier version had `الموسم\s*[^\n]*\n+` — overlapping quantifiers made
 * it quadratic (8.4s on 100k spaces, measured). Do not reintroduce \s* there;
 * the ReDoS regression test in series-rules.test.mjs guards this.
 */
export function cleanSynopsis(s) {
  if (!s) return '';
  let t = String(s)
    .replace(/^قصة\s*الأنمي\s*[:：]?\s*/i, '')
    .replace(/^ملخص\s*[^\n]{0,80}[:：]\s*/i, '')
    .trim();

  // Strip leading greetings/announcements/lines if followed by actual synopsis paragraphs
  t = t.replace(/^(?:#فضفضة[^\n]*\n+|السلام\s*عليكم[^\n]*\n+|مرحبا[^\n]*\n+|أهلًا\s*بالجميع[^\n]*\n+|تادا[^\n]*\n+|مبارك\s*عليكم[^\n]*\n+|نقد[مك]\s*لكم[^\n]*\n+|نقدم\s*لكم[^\n]*\n+|يسرنا[^\n]*\n+|يُ?سعدني[^\n]*\n+|يسعدنا[^\n]*\n+|نعود\s*لكم[^\n]*\n+|رجعنا\s*لكم[^\n]*\n+|ه?آي\s*مينا[^\n]*\n+|الموسم[^\n]*\n+|Anime Info[^\n]*\n+)+/i, '').trim();

  // If text is pure metadata or staff lines
  if (/^(التصنيف|الحالة|استوديو|سنة الإصدار|الموسم|النوع|الحلقات|Anime Info|TL|TLC|QC|TS|Encode)\s*:/i.test(t)) return '';
  if (/Anime Info\s*:\s*MAL/i.test(t)) return '';

  // Chatter & release-announcement starters
  const CHATTER_RE = /^(?:نقد[مك]\s*لكم|يسرنا|يُ?سعدني|يسعدنا|نعود\s*لكم|رجعنا\s*لكم|ه?آي\s*مينا|وأخيرًا\s*خلصنا|خلصنا\s*صيانة|السلام\s*عليكم|مرحبا|أهلًا\s*بالجميع|تادا|مبارك\s*عليكم|إصدار\s*بديل|حلقت[اي]ن?\s*(?:أوفا|خاصة)|حلقة\s*خاصة|الحلقة\s*(?:الـ?\d+|الأخيرة|الثالثة|الصفرية)|نصل\s*(?:ل?ختام|إلى\s*الحلقة|إلى\s*نهاية)|وها\s*نحن\s*نختتم|ننهي\s*رحلتنا|انتهيت\s*أخيرًا|يوه\s*شيء|وذهب\s*شهر|يا\s*لعزة\s*هذا\s*الشهر|الفولي?وم\s*(?:الأول|الثاني|الثالث|الرابع|الخامس|الأخير)|وإلى\s*هنا\s*نصل|هناك\s*بعد\s*التعديلات|ونفجر\s*بيها|أكيد\s*عارفنه|#فضفضة|مشروع\s*مصغر|هذه\s*الأوفا|حلقات\s*خاصة|أوفا\s*تكمل|بفضل\s*الله\s*ثم|معلومة\s*عن\s*العمل|بعد\s*مضي\s*أكثر\s*من\s*10\s*أعوام)/i;

  if (CHATTER_RE.test(t) && (t.length < 250 || !/تدور\s*احداث|تدور\s*القصة|يحكي|تبدأ|تتحدث|طالب\s*ثانوية|فتاة|شاب|عالم|مدينة|يعيش/i.test(t))) {
    return '';
  }

  if (t.length < 25) return '';
  return t;
}

/**
 * Canonical episode ordering: latest first (highest episode number at the
 * top of the page, episode 1 at the bottom). Dated entries compare by date
 * first; undated pairs fall back to number, then slug.
 */
export function compareEpisodesDesc(a, b) {
  if (a.date && b.date) {
    const dCmp = String(b.date).localeCompare(String(a.date));
    if (dCmp !== 0) return dCmp;
  }
  const numA = a.number ?? 0;
  const numB = b.number ?? 0;
  if (numB !== numA) return numB - numA;
  return String(b.slug).localeCompare(String(a.slug));
}
