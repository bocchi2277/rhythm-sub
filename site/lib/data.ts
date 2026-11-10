import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizePageHtml } from './sanitize';
import { safeUrl } from './url';

// Resolve site/data roots from this module's location (site/lib/ -> site/ -> repo root)
// instead of process.cwd(), which is only correct when the build runs from site/.
const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.resolve(SITE_ROOT, '..', 'data');

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

let manifest: Manifest;
try {
  // Kept OUTSIDE public/ so the manifest (222KB of raw upstream URLs) is never
  // published into the static export — it is build-time data only.
  manifest = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'img-manifest.json'), 'utf8'));
} catch (e) {
  throw new Error(`Failed to read img-manifest.json: ${(e as Error).message}`);
}

export function img(url?: string | null): string {
  if (!url) return '/placeholder.svg';
  const local = manifest[url];
  if (local) return local;
  // Only allow local site assets through; reject protocol-relative
  // (//evil.com/x) and any absolute URL to avoid referrer/tracker leaks.
  // Off-allowlist hosts (e.g. 28 i.imgur.com URLs) intentionally fall back
  // to the placeholder instead of hotlinking — isAllowedImageHost() in
  // scraper/src/util.mjs gates the same list at download time.
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return '/placeholder.svg';
}

export { cssUrl } from './css-url';

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
    q.links = (q.links ?? [])
      .map((l) => ({ name: cleanTags(l.name), url: safeUrl(l.url) ?? '' }))
      // Drop links with missing/unsafe schemes (e.g. javascript: from a
      // compromised upstream or a malformed team release) — every href the
      // site renders comes from here.
      .filter((l) => l.name && l.url);
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

  // Sort episodes DESCENDING (latest/highest at top of page, episode 1 at bottom)
  s.episodes.sort((a, b) => {
    if (a.date && b.date) {
      const dCmp = String(b.date).localeCompare(String(a.date));
      if (dCmp !== 0) return dCmp;
    }
    const numA = a.number ?? 0;
    const numB = b.number ?? 0;
    if (numB !== numA) return numB - numA;
    return String(b.slug).localeCompare(String(a.slug));
  });
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
    const seenCovers = new Set<string>();
    const distinctWorks = works.filter((w) => {
      if (w.cover && seenCovers.has(w.cover)) return false;
      if (w.cover) seenCovers.add(w.cover);
      return true;
    });
    return { name: words || sorted[0].title, works: distinctWorks.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)) };
  })
  .sort((a, b) => b.works.length - a.works.length);

type TeamReleaseFile = { file: string; value: Record<string, unknown> };

function readTeamReleases(): TeamReleaseFile[] {
  const dir = path.join(DATA_ROOT, 'releases');
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

function normalizeTeamQualities(input: unknown, file: string): Quality[] {
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

const teamReleases = readTeamReleases();

function slugifySeries(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

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
  let s = merged.find((x) => x.slug === slug);
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
    merged.push(s);
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
  // Keep descending (latest first) — matches the 266-301 sort above;
  // ascending here made schedule's episodes[0] the earliest episode.
  s.episodes.sort((a, b) => {
    if (a.date && b.date) {
      const dCmp = String(b.date).localeCompare(String(a.date));
      if (dCmp !== 0) return dCmp;
    }
    return (b.number ?? 0) - (a.number ?? 0);
  });
}

export const allSeries: Series[] = merged;

function asciiSlug(raw: string): string {
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
  /** Detected in the RAW markup before sanitization (which strips <form>). */
  hasForm?: boolean;
};

let sitePages: Record<string, SitePage> = {};
let curatedProjectSlugs: string[] = [];
let siteSocials: { href: string; label: string }[] = [];
try {
  const pagesDir = path.join(DATA_ROOT, 'pages');
  const mapPageImages = (html: string): string =>
    html.replace(/https?:\/\/(?:i\d\.wp\.com\/)?rhythm-sub\.com\/wp-content\/[^"'\s)]+/g, (u) => {
      const clean = u.replace(/^(https?:\/\/)(i\d\.wp\.com\/)?rhythm-sub\.com/, 'https://rhythm-sub.com').split('?')[0];
      return img(clean);
    });
  const normalizeWpImgRows = (html: string): string =>
    html.replace(
      /<p([^>]*)>((?:\s|&nbsp;)*(?:<img[^>]*>(?:\s|&nbsp;)*)+)<\/p>/gi,
      (m, attrs: string, inner: string) => {
        // Idempotent: sitePage() already normalizes, then about/support call
        // mappedHtml() which normalizes again. Skip rows already tagged.
        if (attrs.includes('wp-img-row')) return m;
        const imgs = inner.match(/<img[^>]*>/g) ?? [];
        const single = imgs.length === 1 ? ' single' : '';
        return `<p${attrs} class="wp-img-row${single}">${imgs.join('')}</p>`;
      }
    );
  for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const p = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
    const key = p.key ?? f.replace(/\.json$/, '');
    const rawHtml = typeof p.contentHtml === 'string' ? p.contentHtml : '';
    // Detect the contact form in the RAW markup: sanitizePageHtml() strips
    // <form> entirely, so the flag must be captured before it runs.
    const hasForm = /<form[\s>]/i.test(rawHtml);
    // Store sanitized+mapped HTML so every consumer (including accidental direct
    // use of sitePage().contentHtml) gets safe output. mappedHtml() remains for
    // raw HTML inputs and is idempotent-safe for already-sanitized markup.
    const contentHtml = normalizeWpImgRows(mapPageImages(sanitizePageHtml(rawHtml)));
    sitePages[key] = { ...p, key, contentHtml, hasForm, images: (p.images ?? []).map((u: string) => img(u)) };
  }
  const extras = JSON.parse(fs.readFileSync(path.join(pagesDir, '_home_extras.json'), 'utf8'));
  siteSocials = extras.socials ?? [];
  curatedProjectSlugs = (extras.projectPostUrls ?? [])
    .map((u: string) => {
      try {
        return asciiSlug(normalizeSlug(new URL(u).pathname.split('/').pop() ?? ''));
      } catch {
        console.warn(`⚠️ Skipping malformed project URL: ${u}`);
        return '';
      }
    })
    .filter(Boolean);
} catch (e) {
  throw new Error(`Failed to read data/pages: ${(e as Error).message}`);
}

export function sitePage(key: string): SitePage | null {
  return sitePages[key] ?? null;
}

export function mappedHtml(html: string): string {
  // Scraped upstream markup is untrusted: sanitize through an allowlist before
  // it reaches dangerouslySetInnerHTML (stored XSS if the source is compromised).
  const mapped = sanitizePageHtml(html).replace(/https?:\/\/(?:i\d\.wp\.com\/)?rhythm-sub\.com\/wp-content\/[^"'\s)]+/g, (u) => {
    const clean = u.replace(/^(https?:\/\/)(i\d\.wp\.com\/)?rhythm-sub\.com/, 'https://rhythm-sub.com').split('?')[0];
    return img(clean);
  });
  // Normalize WordPress card rows: strip &nbsp; spacers inside paragraphs that hold
  // multiple images, so CSS can lay them out as clean centered flex rows.
  // Idempotent w.r.t. sitePage()'s identical transform (see normalizeWpImgRows).
  return mapped.replace(
    /<p([^>]*)>((?:\s|&nbsp;)*(?:<img[^>]*>(?:\s|&nbsp;)*)+)<\/p>/gi,
    (m, attrs: string, inner: string) => {
      if (attrs.includes('wp-img-row')) return m;
      const imgs = inner.match(/<img[^>]*>/g) ?? [];
      const single = imgs.length === 1 ? ' single' : '';
      return `<p${attrs} class="wp-img-row${single}">${imgs.join('')}</p>`;
    }
  );
}

export const socials = siteSocials;

const bySlugMap = new Map(allSeries.map((s) => [s.slug, s]));
const byKeyMap = new Map(allSeries.map((s) => [s.key, s]));

export const currentProjects = curatedProjectSlugs.length
  ? curatedProjectSlugs.map((sl) => bySlugMap.get(sl)).filter(Boolean) as Series[]
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

export function bySlug(slug: string) {
  return bySlugMap.get(slug);
}

export function byKey(key: string) {
  return byKeyMap.get(key);
}
