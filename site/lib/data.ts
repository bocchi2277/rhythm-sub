import fs from 'node:fs';
import path from 'node:path';

export type Quality = { quality: string; links: { name: string; url: string }[] };
export type Episode = {
  slug: string;
  url: string;
  number: number | null;
  label: string;
  date: string | null;
  rating: number | null;
  cover: string | null;
  cardImage?: string | null;
  displayNum?: string | null;
  synopsis: string;
  trailerYoutubeId: string | null;
  qualities: Quality[];
  contentImages: string[];
  postId: string | null;
  author: string;
  contentHtml: string;
};
export type Series = {
  key: string;
  malUrl: string | null;
  slug: string;
  title: string;
  altTitles: string[] | null;
  cover: string | null;
  genres: string[];
  status: string | null;
  studio: string | null;
  year: number | null;
  season: { text: string; slug: string | null } | null;
  type: { text: string; slug: string | null } | null;
  episodesCount: number | null;
  rating: number | null;
  synopsis: string;
  trailerYoutubeId: string | null;
  staff: Record<string, string[]>;
  relatedSeries: string[];
  lastReleaseAt: string | null;
  episodes: Episode[];
};

type Manifest = Record<string, string>;

let manifest: Manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'img-manifest.json'), 'utf8'));
} catch {}

export function img(url?: string | null): string {
  if (!url) return '/placeholder.svg';
  const local = manifest[url];
  if (local) return local;
  if (url.startsWith('/')) return url;
  return '/placeholder.svg';
}

function loadJson(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'data', rel), 'utf8'));
}

const raw: Series[] = loadJson('series.json');

// ── Split foreign-work posts filed under the wrong series ──────────────────
// Source-data corruption happens: a scraper group keyed to one MAL entry can
// absorb posts of a DIFFERENT show (real case: 8 "Kono Subarashii Sekai ni
// Bakuen wo!" volume posts + 1 Mushoku-Tensei episode under a single object,
// with the Bakuen MAL key but the Mushoku slug/title). Episodes whose title
// shares ZERO meaningful tokens with the series' dominant title cannot be the
// same work → regroup them into their own synthetic series.
const tokenizeWork = (t: string): string[] =>
  t.toLowerCase().match(/[a-z0-9\u0600-\u06FF]{3,}/g) ?? [];
const workStem = (t: string) => {
  let l = String(t).trim();
  let prev: string | null = null;
  while (prev !== l) {
    prev = l;
    l = l.replace(/(\s*[-~]\s*)(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
    l = l.replace(/\s+(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
    l = l.replace(/[\s\-~]+$/, '');
  }
  return l.trim();
};
// Case-preserving title for a stem: drop the trailing episode/vol token
// (with or without a dash: "Show - 05" and "Show Vol.02" both reduce to "Show").
const workTitle = (t: string) =>
  t
    .replace(/(\s*[-~]\s*)(?:Vol\.?\s*)?\d{1,4}(\s*(?:END|الأخيرة)?)?\s*$/i, '')
    .replace(/\s+(?:Vol\.?\s*)?\d{1,4}(\s*(?:END|الأخيرة)?)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

function splitForeignWorks(seriesList: Series[]): Series[] {
  const synthetics: Series[] = [];
  const knownSlugs = new Set(seriesList.map((s) => s.slug));
  for (const s of seriesList) {
    // Text that survives bracket stripping; a fully-tagged label ("[HEX][1080p
    // HEVC AAC]") falls back to its download-row name, which carries the real
    // work title.
    const textOf = (e: Episode) => {
      const stripped = e.label.replace(/\[[^\]]*\]/g, '').trim();
      return stripped || e.qualities[0]?.quality?.trim() || e.label || '';
    };
    if (s.episodes.length < 3) continue;
    const stems = s.episodes.map((e) => workStem(textOf(e)).toLowerCase());
    const counts = new Map<string, number>();
    for (const st of stems) counts.set(st, (counts.get(st) ?? 0) + 1);
    let anchor = '';
    let anchorN = 0;
    for (const [st, n] of counts) {
      if (n > anchorN) {
        anchor = st;
        anchorN = n;
      }
    }
    // No clear majority → ambiguous mixture, leave untouched rather than guess.
    // A foreign blob can OUTNUMBER the host's own posts (8 Bakuen volumes vs 10
    // Mushoku episodes), so require only a plurality, and only split when the
    // minority side has ≥2 cards (never exile a lone differently-titled post).
    if (anchorN < Math.max(3, s.episodes.length / 4)) continue;
    // Host stem = the stem matching the series' OWN title when one exists
    // (users on /anime/<slug> expect the titled work); otherwise the dominant
    // stem. Compare episodes against the HOST stem alone — never union the
    // series title into the whitelist, or the minority titled work becomes
    // un-exilable and the split silently no-ops.
    const titleTokens = tokenizeWork(s.title ?? '');
    let hostStem = '';
    for (const st of counts.keys()) {
      if (tokenizeWork(st).some((w) => titleTokens.includes(w))) {
        hostStem = st;
        break;
      }
    }
    if (!hostStem) hostStem = anchor;
    const hostTokens = new Set(tokenizeWork(hostStem));
    const foreign = s.episodes.filter((e) => {
      const tk = tokenizeWork(workStem(textOf(e)));
      return tk.length > 0 && !tk.some((w) => hostTokens.has(w));
    });
    if (foreign.length < 2 || foreign.length >= s.episodes.length) continue;
    const groups = new Map<string, Episode[]>();
    for (const e of foreign) {
      const st = workStem(textOf(e)).toLowerCase();
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st)!.push(e);
    }
    const foreignSet = new Set(foreign);
    s.episodes = s.episodes.filter((e) => !foreignSet.has(e));
    // The host kept the majority content: retitle it from that majority so the
    // page heading matches what the page actually lists. When the host kept
    // the title-matching minority instead, derive the title from its own
    // remaining episodes (also strips raw-title stickers like "Part 2 – 10 ~ 11").
    const anchorRep = s.episodes.find((e) => workStem(textOf(e)).toLowerCase() === anchor);
    if (anchorRep) {
      s.title = workTitle(textOf(anchorRep));
    } else {
      const ownTitle = workTitle(textOf(s.episodes[0]));
      if (ownTitle) s.title = ownTitle;
    }
    for (const [, eps] of groups) {
      const base = workTitle(textOf(eps[0]));
      let slug = slugifySeries(base) || `${s.slug}-x`;
      while (knownSlugs.has(slug)) slug += '-x';
      knownSlugs.add(slug);
      synthetics.push({
        key: `${s.key}:x:${slug}`,
        malUrl: null,
        slug,
        title: base,
        altTitles: null,
        cover: eps.find((e) => e.cover)?.cover ?? null,
        genres: [],
        status: 'Ongoing',
        studio: null,
        year: null,
        season: null,
        type: s.type,
        episodesCount: null,
        rating: null,
        synopsis: '',
        trailerYoutubeId: null,
        staff: {},
        relatedSeries: [],
        lastReleaseAt: null,
        episodes: eps
      });
    }
  }
  return [...seriesList, ...synthetics];
}

const merged = splitForeignWorks(raw);

function displayNumber(ep: { label: string; number: number | null; slug: string }): string | null {
  // Ignore scraper noise that can trail the number ("[HEXHASH]", "LEAKED") so a
  // title like "Series - 01 [CC80CD66] LEAKED" still yields a badge.
  const label = ep.label.replace(/\[[0-9A-Fa-f]{6,12}\]/g, ' ').replace(/\s*LEAKED\s*$/i, '');
  const range = label.match(/(\d{1,4})\s*[~\-]\s*(\d{1,4})(?!\d)/);
  if (range && /~/.test(label)) return `${parseInt(range[1], 10)}~${parseInt(range[2], 10)}`;
  const inLabel = label.match(/(?:-|\s|#|الحلقة\s)(\d{1,4})(?!\d)\s*(?:END|الأخيرة)?\s*$/i);
  if (inLabel) return String(parseInt(inLabel[1], 10));
  return ep.number != null ? String(ep.number) : null;
}

function safeSynopsis(s: string | null | undefined): string {
  if (!s) return '';
  let t = String(s)
    .replace(/^قصة\s*الأنمي\s*[:：]?\s*/i, '')
    .replace(/^ملخص\s*[^\n]{0,80}[:：]\s*/i, '')
    .trim();

  // Strip leading greetings/announcements/lines if followed by actual synopsis paragraphs
  t = t.replace(/^(?:#فضفضة[^\n]*\n+|السلام\s*عليكم[^\n]*\n+|مرحبا[^\n]*\n+|أهلًا\s*بالجميع[^\n]*\n+|تادا[^\n]*\n+|مبارك\s*عليكم[^\n]*\n+|نقد[مك]\s*لكم[^\n]*\n+|يسرنا[^\n]*\n+|يُ?سعدني[^\n]*\n+|يسعدنا[^\n]*\n+|نعود\s*لكم[^\n]*\n+|رجعنا\s*لكم[^\n]*\n+|ه?آي\s*مينا[^\n]*\n+|الموسم\s*[^\n]*\n+|Anime Info[^\n]*\n+)+/i, '').trim();

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

// Strip scraper noise: [HEXHASH] groups, leftover empty groups, doubled opening
// brackets ("[CC80CD66][[VHS 1080p AAC]" → "VHS 1080p AAC") and a fully-wrapping
// outer pair ("[720p AAC]" → "720p AAC"). Meaningful tags ([HARD-SUB], [01~04])
// are preserved. Must run AFTER batch-split detection, which needs raw hashes.
function cleanTags(input: string): string {
  let s = input.replace(/\[[0-9A-Fa-f]{6,12}\]/g, ' ');
  s = s.replace(/\[\s*\]/g, ' ');
  while (/\[\[/.test(s)) s = s.replace(/\[\[/g, '[');
  s = s.trim();
  const wrapped = s.match(/^\[([^[\]]+)\]$/);
  if (wrapped) s = wrapped[1];
  return s.replace(/\s{2,}/g, ' ').trim();
}

function cleanLabel(input: string): string {
  return cleanTags(input)
    .replace(/\s*LEAKED\s*$/i, '')
    .trim();
}

function cleanEpisodeText(ep: Episode): void {
  ep.label = cleanLabel(ep.label);
  for (const q of ep.qualities) {
    q.quality = cleanTags(q.quality);
    for (const l of q.links) l.name = cleanTags(l.name);
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
  const expanded: Episode[] = [];
  for (const e of s.episodes) {
    // A post whose ENTIRE title is scraper tags ("[3CE53AB8][1080p HEVC AAC]")
    // carries no work name at all: rebuild it from the series title plus the
    // episode number embedded in the post slug, so users never see a bare
    // quality string as a card title.
    const strippedLabel = e.label.replace(/\[[^\]]*\]/g, '').trim();
    if (!strippedLabel && s.title) {
      const m = e.slug.match(/-(\d{1,4})(?:-end)?$/);
      if (m) e.label = `${s.title} - ${parseInt(m[1], 10)}`;
    }
    e.contentImages = e.contentImages ?? [];
    const distinct = e.contentImages.find((u) => u && u !== e.cover);
    e.cardImage = distinct ?? e.cover ?? null;
    e.displayNum = displayNumber(e);

    const range = e.displayNum?.match(/^(\d{1,4})~(\d{1,4})$/);
    // ── UNIVERSAL episodic-batch rule ─────────────────────────────────────────
    // A post with >=4 quality rows that all share the SAME quality string but carry
    // DISTINCT hex hashes = N consecutive episode FILES in one post (Revive's 01..04
    // card pattern). This holds regardless of how the post is titled:
    //   "Vol.06 - 21"  → episodes 21..24   (volume convention: X after the dash)
    //   "Anime - 01"   → episodes start..start+N-1 (season batch labeled by first ep)
    // Multi-quality re-encodes of ONE episode/movie never look like this, because their
    // rows differ in the quality string itself (1080p vs 720p vs HEVC...).
    const baseQuality = (q: { quality: string }) => q.quality.replace(/\[[0-9A-Fa-f]{6,12}\]/g, '').trim();
    const hashed = e.qualities.filter((q) => /\[[0-9A-Fa-f]{6,12}\]/.test(q.quality));
    const distinctHashes = new Set(hashed.map((q) => (q.quality.match(/\[[0-9A-Fa-f]{6,12}\]/) ?? [''])[0]));
    const hashBatch =
      hashed.length >= 4 && distinctHashes.size >= 4 && new Set(hashed.map(baseQuality)).size === 1;
    const singleBatch =
      e.displayNum &&
      /^\d{1,4}$/.test(e.displayNum) &&
      !hashBatch &&
      e.qualities.length >= 6;
    // Explicit range in the label wins ("Vol.NN - X", "01~12"); degenerate "N - N" ignored.
    const labelRange = e.label.match(/(?:^|[^0-9])(\d{1,4})\s*[-~]\s*(\d{1,4})(?!\d)/);
    const explicitStart =
      labelRange && parseInt(labelRange[1], 10) < parseInt(labelRange[2], 10)
        ? parseInt(labelRange[2], 10)
        : null;
    const perCardTitle = (n: number) =>
      /(\s*[-~]\s*)\d{1,4}(\s*(?:END|الأخيرة)?)\s*$/i.test(e.label)
        ? e.label.replace(/(\s*[-~]\s*)\d{1,4}(\s*(?:END|الأخيرة)?)\s*$/i, `$1${n}$2`)
        : `${e.label} - ${n}`;
    // GUARD: hashed.length >= 1 — with zero hashed rows the arithmetic below is
    // trivially true (1 === 0+1) and hashed.forEach would emit ZERO cards,
    // silently deleting ordinary single-row posts (lost episodes 7/12 in
    // undead-unluck). Never enter the splitter without at least one hashed file.
    if (hashBatch || (hashed.length >= 1 && e.qualities.length === hashed.length + 1)) {
      // Split each distinct hashed file into its own episode card; any trailing un-hashed
      // row (usually the batch Torrent) rides along on the FIRST card.
      const torrentRows = e.qualities.filter((q) => !/\[[0-9A-Fa-f]{6,12}\]/.test(q.quality));
      const start = explicitStart ?? (e.displayNum ? parseInt(e.displayNum, 10) : null);
      if (start == null) {
        expanded.push(e);
      } else {
        const baseTitle = perCardTitle(start); // strip the trailing number once for the series-level title
        const stem = baseTitle.replace(/(\s*[-~]\s*)\d{1,4}(\s*(?:END|الأخيرة)?)?\s*$/i, '').trim();
        hashed.forEach((q, i) => {
          expanded.push({
            ...e,
            number: start + i,
            displayNum: String(start + i),
            label: `${stem} - ${start + i}`,
            qualities: i === 0 ? [q, ...torrentRows] : [q],
            slug: `${e.slug}-p${start + i}`
          });
        });
      }
    } else if (singleBatch && e.displayNum) {
      const start = parseInt(e.displayNum, 10);
      e.qualities.forEach((q, i) => {
        expanded.push({
          ...e,
          number: start + i,
          displayNum: String(start + i),
          qualities: [q],
          slug: `${e.slug}-p${start + i}`
        });
      });
    } else if (explicitStart != null && !hashBatch && !singleBatch && e.qualities.length >= 3) {
      // Range-style batch without per-file hashes (e.g. "[01~04][BD]" posts): one card per episode.
      e.qualities.forEach((q, i) => {
        expanded.push({
          ...e,
          number: explicitStart + i,
          displayNum: String(explicitStart + i),
          label: perCardTitle(explicitStart + i),
          qualities: [q],
          slug: `${e.slug}-p${explicitStart + i}`
        });
      });
    } else {
      expanded.push(e);
    }
  }
  expanded.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9));

  // ── Deduplicate re-releases (TV weekly post + BD volume batch of the same episode) ──
  // When two cards carry the SAME episode number AND the same title stem, they are the
  // same content published twice (weekly WEB release → remastered BD volume). Merge into
  // ONE card: newest label/date wins, older download rows stack beneath for choice.
  // Corrupt source numbers (e.g. 204 from "2"+"04") never match a sane stem, so they stay.
  // Stem = label with ALL trailing number/Vol tokens removed (loop handles "Vol.03 - 12",
  // "Alya-san 01", "Kiroku Vol.1" — with or without a dash before the number).
  const stemOf = (ep: Episode) => {
    // Strip scraper noise FIRST: a trailing "[HEXHASH]" or "LEAKED" would block
    // the trailing-number loop below and defeat re-release merging.
    let l = ep.label
      .replace(/\[[0-9A-Fa-f]{6,12}\]/g, ' ')
      .replace(/\[\s*\]/g, ' ')
      .replace(/\s*LEAKED\s*$/i, '')
      .trim()
      .toLowerCase();
    let prev: string | null = null;
    while (prev !== l) {
      prev = l;
      l = l.replace(/(\s*[-~]\s*)(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
      l = l.replace(/\s+(?:vol\.?\s*)?\d{1,4}(\s*(?:end|الأخيرة)?)?$/i, '').trim();
      // Punctuation-insensitive: "Re:Dive" ≡ "Re Dive", a trailing "!" must not
      // block matching ("...Bakuen wo!" weekly vs "...Bakuen wo! Vol.03").
      l = l.replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').trim();
      l = l.replace(/[\s\-~]+$/, '');
    }
    return l;
  };
  // Key on the EFFECTIVE badge number (displayNum — what the user actually sees), not the
  // raw scraped `number` field which is sometimes wrong (e.g. "Movie 1" post tagged 2).
  const badgeOf = (ep: Episode): number | null => {
    if (ep.displayNum && /^\d{1,4}$/.test(ep.displayNum)) return parseInt(ep.displayNum, 10);
    return ep.number != null && ep.number <= 9999 ? ep.number : null;
  };
  // Cluster ALL cards sharing one badge number by title stem, THEN merge each
  // cluster. A naive first-wins map breaks with three same-number cards
  // (season-1 weekly + season-2 weekly + its Blu-ray re-release): the third card
  // must match the second, not whichever card happened to arrive first.
  const byNumber = new Map<number, Episode[]>();
  const nullCards: Episode[] = [];
  for (const ep of expanded) {
    const key = badgeOf(ep);
    if (key == null) nullCards.push(ep);
    else {
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key)!.push(ep);
    }
  }
  const skip = new Set<Episode>();
  // One-edit tolerance ("Neppuu" vs "Neppu" source typos) — used ONLY for
  // badge-less movie/special clusters, never for numbered episodes.
  const lev1 = (a: string, b: string) => {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      if (++edits > 1) return false;
      if (a.length === b.length) {
        i++;
        j++;
      } else {
        j++;
      }
    }
    edits += a.length - i + (b.length - j);
    return edits <= 1;
  };
  const collapse = (cards: Episode[], fuzzy = false) => {
    const groups: { st: string; items: Episode[] }[] = [];
    for (const c of cards) {
      const st = stemOf(c);
      const hit = fuzzy ? groups.find((g) => lev1(g.st, st)) : groups.find((g) => g.st === st);
      if (hit) {
        hit.items.push(c);
      } else {
        groups.push({ st, items: [c] });
      }
    }
    for (const group of groups) {
      if (group.items.length < 2) continue;
      // Newest publication wins; equal dates → the later-arrived card (BD/volume
      // posts are appended after the weekly ones in the source feed).
      let wi = 0;
      for (let i = 1; i < group.items.length; i++) {
        if ((group.items[i].date ?? '') >= (group.items[wi].date ?? '')) wi = i;
      }
      const winner = group.items[wi];
      for (let i = 0; i < group.items.length; i++) {
        if (i === wi) continue;
        winner.qualities.push(...group.items[i].qualities);
        skip.add(group.items[i]);
      }
    }
  };
  // No badge (movies/specials): still merge exact-title duplicates — two
  // "Mind Game" posts are the same film published twice. Fuzzy matching also
  // catches one-letter source typos ("Neppuu" vs "Neppu").
  collapse(nullCards, true);
  for (const cards of byNumber.values()) collapse(cards);
  const finalList = expanded.filter((ep) => !skip.has(ep));
  // Scraper-noise cleanup ([HEXHASH] tags, LEAKED, doubled brackets) runs LAST so
  // batch-split detection above still sees the raw hashes it depends on.
  for (const ep of finalList) cleanEpisodeText(ep);
  s.episodes = finalList;
}

const GENERIC_PREFIXES = new Set(['yuusha', 'princess', 'isekai', 'mahou', 'shin', 'super', 'strike', 'kono', 'seishun', 'ore', 'watashi', 'boku', 'toaru', 'gekijouban']);

function getFranchiseKey(slug: string): string | null {
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

const familyMap = new Map<string, Series[]>();
for (const s of merged) {
  const key = getFranchiseKey(s.slug);
  if (key) {
    if (!familyMap.has(key)) familyMap.set(key, []);
    familyMap.get(key)!.push(s);
  }
}

export const franchises: { name: string; works: Series[] }[] = [...familyMap.entries()]
  .filter(([, works]) => works.length > 1)
  .map(([, works]) => {
    const sorted = [...works].sort((a, b) => a.title.length - b.title.length);
    const words = sorted[0].title.replace(/[:–-].*$/, '').trim();
    return { name: words || sorted[0].title, works: [...works].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)) };
  })
  .sort((a, b) => b.works.length - a.works.length);

let teamReleases: Record<string, unknown>[] = [];
try {
  const dir = path.join(process.cwd(), '..', 'data', 'releases');
  teamReleases = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
} catch {}

function slugifySeries(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

for (const r of teamReleases) {
  const slug = String(r.seriesSlug ?? slugifySeries(String(r.seriesTitle ?? '')));
  if (!slug || !r.label) continue;
  let s = merged.find((x) => x.slug === slug);
  if (!s) {
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
      year: r.date ? Number(String(r.date).slice(0, 4)) : null,
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
    merged.push(s);
  }
  s.episodes.push({
    slug: `${slug}-${r.episodeNumber ?? Date.now()}`,
    url: `/anime/${slug}/`,
    number: r.episodeNumber != null ? Number(r.episodeNumber) : null,
    displayNum: r.episodeNumber != null ? String(r.episodeNumber) : null,
    label: String(r.label),
    date: r.date ? `${r.date}T00:00:00+03:00` : null,
    rating: null,
    cover: typeof r.coverUrl === 'string' && r.coverUrl.startsWith('/img/') ? r.coverUrl : null,
    synopsis: String(r.synopsis ?? ''),
    trailerYoutubeId: null,
    qualities: Array.isArray(r.qualities)
      ? (r.qualities as Quality[])
      : [],
    contentImages: [],
    postId: null,
    author: 'team',
    contentHtml: ''
  });
  if (Object.keys(r.staff ?? {}).length) {
    for (const [role, names] of Object.entries(r.staff as Record<string, string[]>)) {
      s.staff[role] = [...new Set([...(s.staff[role] ?? []), ...names])];
    }
  }
  s.episodes.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9));
}

export const allSeries: Series[] = merged;

function asciiSlug(raw: string): string {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {}
  s = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'anime';
}

function normalizeSlug(slug: string): string {
  return slug
    .replace(/-(?:episode|ep)-?\d{1,4}$/i, '')
    .replace(/-\d{1,4}$/, '')
    .replace(/-\d{1,4}(?:-\d{1,2})?$/, '');
}

export type SitePage = {
  key: string;
  url: string;
  title: string;
  contentHtml: string;
  images: string[];
};

type FooterData = { footerHtml: string; socials: { name: string; url: string }[] };

let sitePages: Record<string, SitePage> = {};
let footerData: FooterData = { footerHtml: '', socials: [] };
let curatedProjectSlugs: string[] = [];
let siteSocials: { href: string; label: string }[] = [];
try {
  const pagesDir = path.join(process.cwd(), '..', 'data', 'pages');
  for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const p = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
    const key = p.key ?? f.replace(/\.json$/, '');
    sitePages[key] = { ...p, key, images: (p.images ?? []).map((u: string) => img(u)) };
  }
  footerData = JSON.parse(fs.readFileSync(path.join(pagesDir, '_footer.json'), 'utf8'));
  const extras = JSON.parse(fs.readFileSync(path.join(pagesDir, '_home_extras.json'), 'utf8'));
  siteSocials = extras.socials ?? [];
  curatedProjectSlugs = (extras.projectPostUrls ?? [])
    .map((u: string) => asciiSlug(normalizeSlug(new URL(u).pathname.split('/').pop() ?? '')))
    .filter(Boolean);
} catch {}

export function sitePage(key: string): SitePage | null {
  return sitePages[key] ?? null;
}

export function mappedHtml(html: string): string {
  const mapped = html.replace(/https?:\/\/(?:i\d\.wp\.com\/)?rhythm-sub\.com\/wp-content\/[^"'\s)]+/g, (u) => {
    const clean = u.replace(/^(https?:\/\/)(i\d\.wp\.com\/)?rhythm-sub\.com/, 'https://rhythm-sub.com').split('?')[0];
    return img(clean);
  });
  // Normalize WordPress card rows: strip &nbsp; spacers inside paragraphs that hold
  // multiple images, so CSS can lay them out as clean centered flex rows.
  return mapped.replace(
    /<p([^>]*)>((?:\s|&nbsp;)*(?:<img[^>]*>(?:\s|&nbsp;*)*)+)<\/p>/gi,
    (_m, attrs: string, inner: string) => {
      const imgs = inner.match(/<img[^>]*>/g) ?? [];
      const single = imgs.length === 1 ? ' single' : '';
      return `<p${attrs} class="wp-img-row${single}">${imgs.join('')}</p>`;
    }
  );
}

export const footer = footerData;
export const socials = siteSocials;

const bySlugMap = new Map(allSeries.map((s) => [s.slug, s]));

export const currentProjects = curatedProjectSlugs.length
  ? curatedProjectSlugs.map((sl) => bySlugMap.get(sl)).filter(Boolean) as Series[]
  : allSeries
      .filter((s) => /ongoing/i.test(s.status ?? ''))
      .filter((s) => s.lastReleaseAt && Date.now() - new Date(s.lastReleaseAt).getTime() < 30 * 24 * 3600 * 1000)
      .sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));

export const latestReleases = allSeries
  .flatMap((s) => s.episodes.map((e) => ({ series: s, ep: e })))
  .sort((a, b) => {
    const dateCmp = String(b.ep.date ?? '').localeCompare(String(a.ep.date ?? ''));
    if (dateCmp !== 0) return dateCmp;
    const numA = (a.ep.number ?? (a.ep.displayNum ? parseInt(a.ep.displayNum, 10) : 0)) || 0;
    const numB = (b.ep.number ?? (b.ep.displayNum ? parseInt(b.ep.displayNum, 10) : 0)) || 0;
    if (numB !== numA) return numB - numA;
    return String(b.ep.slug).localeCompare(String(a.ep.slug));
  });

export function formatWorksCount(count: number): string {
  if (count === 1) return 'عمل واحد';
  if (count === 2) return 'عملان';
  if (count >= 3 && count <= 10) return `${count} أعمال`;
  return `${count} عمل`;
}

export const ongoing = allSeries.filter((s) => /ongoing/i.test(s.status ?? ''));

export function bySlug(slug: string) {
  return allSeries.find((s) => s.slug === slug);
}

export function byKey(key: string) {
  return allSeries.find((s) => s.key === key);
}

export const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0-9'.split('');
