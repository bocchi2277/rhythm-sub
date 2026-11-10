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

/**
 * Normalize a scraped synopsis: strip the "قصة الأنمي:" prefix, drop
 * greeting/announcement paragraphs and pure metadata blocks, and reject
 * chatter that is not an actual plot summary.
 */
export function safeSynopsis(s: string | null | undefined): string {
  if (!s) return '';
  let t = String(s)
    .replace(/^قصة\s*الأنمي\s*[:：]?\s*/i, '')
    .replace(/^ملخص\s*[^\n]{0,80}[:：]\s*/i, '')
    .trim();

  // Strip leading greetings/announcements/lines if followed by actual synopsis paragraphs
  t = t
    .replace(
      /^(?:#فضفضة[^\n]*\n+|السلام\s*عليكم[^\n]*\n+|مرحبا[^\n]*\n+|أهلًا\s*بالجميع[^\n]*\n+|تادا[^\n]*\n+|مبارك\s*عليكم[^\n]*\n+|نقد[مك]\s*لكم[^\n]*\n+|نقدم\s*لكم[^\n]*\n+|يسرنا[^\n]*\n+|يُ?سعدني[^\n]*\n+|يسعدنا[^\n]*\n+|نعود\s*لكم[^\n]*\n+|رجعنا\s*لكم[^\n]*\n+|ه?آي\s*مينا[^\n]*\n+|الموسم\s*[^\n]*\n+|Anime Info[^\n]*\n+)+/i,
      ''
    )
    .trim();

  // If text is pure metadata or staff lines
  if (/^(التصنيف|الحالة|استوديو|سنة الإصدار|الموسم|النوع|الحلقات|Anime Info|TL|TLC|QC|TS|Encode)\s*:/i.test(t)) return '';
  if (/Anime Info\s*:\s*MAL/i.test(t)) return '';

  // Chatter & release-announcement starters
  const CHATTER_RE =
    /^(?:نقد[مك]\s*لكم|يسرنا|يُ?سعدني|يسعدنا|نعود\s*لكم|رجعنا\s*لكم|ه?آي\s*مينا|وأخيرًا\s*خلصنا|خلصنا\s*صيانة|السلام\s*عليكم|مرحبا|أهلًا\s*بالجميع|تادا|مبارك\s*عليكم|إصدار\s*بديل|حلقت[اي]ن?\s*(?:أوفا|خاصة)|حلقة\s*خاصة|الحلقة\s*(?:الـ?\d+|الأخيرة|الثالثة|الصفرية)|نصل\s*(?:ل?ختام|إلى\s*الحلقة|إلى\s*نهاية)|وها\s*نحن\s*نختتم|ننهي\s*رحلتنا|انتهيت\s*أخيرًا|يوه\s*شيء|وذهب\s*شهر|يا\s*لعزة\s*هذا\s*الشهر|الفولي?وم\s*(?:الأول|الثاني|الثالث|الرابع|الخامس|الأخير)|وإلى\s*هنا\s*نصل|هناك\s*بعد\s*التعديلات|ونفجر\s*بيها|أكيد\s*عارفنه|#فضفضة|مشروع\s*مصغر|هذه\s*الأوفا|حلقات\s*خاصة|أوفا\s*تكمل|بفضل\s*الله\s*ثم|معلومة\s*عن\s*العمل|بعد\s*مضي\s*أكثر\s*من\s*10\s*أعوام)/i;

  if (
    CHATTER_RE.test(t) &&
    (t.length < 250 || !/تدور\s*احداث|تدور\s*القصة|يحكي|تبدأ|تتحدث|طالب\s*ثانوية|فتاة|شاب|عالم|مدينة|يعيش/i.test(t))
  ) {
    return '';
  }

  if (t.length < 25) return '';
  return t;
}
