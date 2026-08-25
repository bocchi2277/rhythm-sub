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

const merged = [...raw];

function displayNumber(ep: { label: string; number: number | null; slug: string }): string | null {
  const range = ep.label.match(/(\d{1,4})\s*[~\-]\s*(\d{1,4})(?!\d)/);
  if (range && /~/.test(ep.label)) return `${parseInt(range[1], 10)}~${parseInt(range[2], 10)}`;
  const inLabel = ep.label.match(/(?:-|\s|#|الحلقة\s)(\d{1,4})(?!\d)\s*(?:END|الأخيرة)?\s*$/i);
  if (inLabel) return String(parseInt(inLabel[1], 10));
  return ep.number != null ? String(ep.number) : null;
}

function safeSynopsis(s: string | null | undefined): string {
  if (!s) return '';
  const t = String(s)
    .replace(/^قصة\s*الأنمي\s*[:：]?\s*/i, '')
    .trim();
  if (/^(التصنيف|الحالة|استوديو|سنة الإصدار|الموسم|النوع|الحلقات)\s*:/.test(t)) return '';
  return t;
}

for (const s of merged) {
  s.synopsis = safeSynopsis(s.synopsis);
  const expanded: Episode[] = [];
  for (const e of s.episodes) {
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
    const hashBatch =
      hashed.length >= 4 && new Set(hashed.map(baseQuality)).size === 1;
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
    if (hashBatch || e.qualities.length === hashed.length + 1) {
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
  s.episodes = expanded;
}

const familyMap = new Map<string, Series[]>();
for (const s of merged) {
  const token = s.slug.split('-')[0];
  if (token.length >= 4) {
    if (!familyMap.has(token)) familyMap.set(token, []);
    familyMap.get(token)!.push(s);
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
  .sort((a, b) => String(b.ep.date ?? '').localeCompare(String(a.ep.date ?? '')));

export const ongoing = allSeries.filter((s) => /ongoing/i.test(s.status ?? ''));

export function bySlug(slug: string) {
  return allSeries.find((s) => s.slug === slug);
}

export function byKey(key: string) {
  return allSeries.find((s) => s.key === key);
}

export const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0-9'.split('');
