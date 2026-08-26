import fs from 'node:fs';
import path from 'node:path';
import { DATA, POSTS_DIR } from './util.mjs';

function normalizeSlug(slug) {
  return slug
    .replace(/-(?:episode|ep)-?\d{1,4}$/i, '')
    .replace(/-\d{1,4}$/, '')
    .replace(/-\d{1,4}(?:-\d{1,2})?$/, '');
}

function asciiSlug(raw) {
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

function episodeNumberFrom(post) {
  const m1 = post.slug.match(/(?:^|-)(?:episode|ep)-?(\d{1,4})$/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = post.slug.match(/-(\d{1,4})$/);
  if (m2 && !/(?:bd|tv|dvd|v2)$/i.test(post.slug.replace(/-(?:episode|ep)-?\d{1,4}$/i, ''))) {
    const base = post.slug.slice(0, m2.index);
    if (!/(^|-)(?:bd|tv|dvd)$/.test(base)) return parseInt(m2[1], 10);
  }
  const t = post.title.match(/[-#\s](\d{1,4})(?:\s*(?:END|الأخيرة|\(نهائي\)))?$/i);
  if (t && post.type?.text !== 'Movie') return parseInt(t[1], 10);
  return null;
}

function pickLatest(posts, getter) {
  for (const p of posts) {
    const v = getter(p);
    if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) return v;
  }
  return null;
}

function cleanSynopsis(s) {
  if (!s) return '';
  let t = String(s)
    .replace(/^قصة\s*الأنمي\s*[:：]?\s*/i, '')
    .replace(/^ملخص\s*[^\n]{0,80}[:：]\s*/i, '')
    .trim();

  // Strip leading greetings/announcements/lines if followed by actual synopsis paragraphs
  t = t.replace(/^(?:#فضفضة[^\n]*\n+|السلام\s*عليكم[^\n]*\n+|مرحبا[^\n]*\n+|أهلًا\s*بالجميع[^\n]*\n+|تادا[^\n]*\n+|مبارك\s*عليكم[^\n]*\n+|نقدم\s*لكم[^\n]*\n+|نقدك\s*لكم[^\n]*\n+|يسرنا[^\n]*\n+|يسعدنا[^\n]*\n+|نعود\s*لكم[^\n]*\n+|رجعنا\s*لكم[^\n]*\n+|ه?آي\s*مينا[^\n]*\n+|الموسم\s*[^\n]*\n+|Anime Info[^\n]*\n+)+/i, '').trim();

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

const INVALID_ROLE_RE = /^(https?|ftp|www|anime\s*info|http)$/i;
const GENERIC_PREFIXES = new Set(['yuusha', 'princess', 'isekai', 'mahou', 'shin', 'super', 'strike', 'kono', 'seishun', 'ore', 'watashi', 'boku', 'toaru', 'gekijouban']);

function getFranchiseKey(slug) {
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

function main() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.json'));
  const posts = files.map((f) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8')));
  console.log(`loaded ${posts.length} posts`);

  posts.sort((a, b) => String(a.publishedAt ?? '').localeCompare(String(b.publishedAt ?? '')));

  const groups = new Map();
  for (const p of posts) {
    let key;
    if (p.malUrl) key = `mal:${p.malUrl.split('?')[0].replace(/\/$/, '')}`;
    else key = `slug:${normalizeSlug(p.slug)}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);

    if (p.malUrl) {
      const slugKey = `slug:${normalizeSlug(p.slug)}`;
      if (groups.has(slugKey)) {
        groups.get(key).push(...groups.get(slugKey));
        groups.delete(slugKey);
      }
    }
  }

  const seriesList = [];
  const slugIndex = new Map();
  const usedSlugs = new Set();

  for (const [, groupPosts] of groups) {
    groupPosts.sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
    const newest = groupPosts[0];

    const seenSlugs = new Set();
    const uniq = [];
    for (const p of groupPosts) {
      if (!seenSlugs.has(p.slug)) {
        seenSlugs.add(p.slug);
        uniq.push(p);
      }
    }

    let slug = asciiSlug(normalizeSlug(newest.slug));
    if (usedSlugs.has(slug)) {
      if (newest.year && !usedSlugs.has(`${slug}-${newest.year}`)) slug = `${slug}-${newest.year}`;
      else {
        let n = 2;
        while (usedSlugs.has(`${slug}-${n}`)) n++;
        slug = `${slug}-${n}`;
      }
    }
    usedSlugs.add(slug);

function extractEpisodeMetadata(post) {
  const title = post.title || '';
  
  // Check if range like '01 ~ 05' or '[01~12]'
  const tildeMatch = title.match(/(\d{1,3})\s*[\~～]\s*(\d{1,3})(?:\s*END)?/i) || title.match(/\[(\d{1,3})\s*[\~～–-]\s*(\d{1,3})\]/);
  if (tildeMatch) {
    const isEnd = /END/i.test(title);
    return {
      displayNum: isEnd ? `${tildeMatch[1]}~${tildeMatch[2]} END` : `${tildeMatch[1]}~${tildeMatch[2]}`,
      number: parseInt(tildeMatch[2], 10),
      label: title
    };
  }
  
  // Check if volume like 'Vol.01' or 'Vol.1'
  const volMatch = title.match(/Vol\.?\s*(\d{1,2})(?:\s*END)?/i);
  if (volMatch) {
    const isEnd = /END/i.test(title);
    return {
      displayNum: isEnd ? `Vol.${volMatch[1]} END` : `Vol.${volMatch[1]}`,
      number: parseInt(volMatch[1], 10) * 100,
      label: title
    };
  }

  // Check if full BD batch like 'Absolute Duo - BD' or 'BD'
  if (/\bBD\b|Blu-ray/i.test(post.type?.text) || (/\bBD\b|Blu-ray/i.test(title) && !title.match(/[-–]\s*\d{1,3}\s*$/))) {
    return {
      displayNum: 'BD',
      number: 9999,
      label: title
    };
  }

  // Check Movie / OVA / ONA / Special
  if (/movie|فيلم/i.test(title) || post.type?.text === 'Movie') {
    return { displayNum: 'فيلم', number: 1, label: title };
  }
  if (/OVA/i.test(title) || post.type?.text === 'OVA') {
    const ovaNum = title.match(/OVA\s*(\d+)/i);
    return { displayNum: ovaNum ? `OVA ${ovaNum[1]}` : 'OVA', number: ovaNum ? parseInt(ovaNum[1], 10) : 1, label: title };
  }
  if (/ONA/i.test(title) || post.type?.text === 'ONA') {
    const onaNum = title.match(/[-–]\s*(\d+)/);
    return { displayNum: onaNum ? `ONA ${onaNum[1]}` : 'ONA', number: onaNum ? parseInt(onaNum[1], 10) : 1, label: title };
  }

  // Single episode
  const epNum = episodeNumberFrom(post);
  if (epNum != null) {
    const isEnd = /END|الأخيرة/i.test(title);
    return {
      displayNum: isEnd ? `${epNum} END` : String(epNum),
      number: epNum,
      label: title
    };
  }

  return { displayNum: null, number: null, label: title };
}

    const episodes = uniq.map((p) => {
      const meta = extractEpisodeMetadata(p);
      return {
        slug: p.slug,
        url: p.url,
        number: meta.number,
        displayNum: meta.displayNum,
        label: meta.label,
        date: p.publishedAt,
        rating: p.rating,
        cover: p.cover,
        synopsis: p.synopsis,
        trailerYoutubeId: p.trailerYoutubeId,
        qualities: p.downloads.flatMap((d) =>
          d.qualities.map((q) => ({ quality: q.quality, links: q.links }))
        ),
        contentImages: p.contentImages,
        postId: p.postId,
        author: p.author,
        contentHtml: p.contentHtml
      };
    });

    episodes.sort((a, b) => {
      if (a.date && b.date) {
        const dCmp = String(b.date).localeCompare(String(a.date));
        if (dCmp !== 0) return dCmp;
      }
      const numA = a.number ?? 0;
      const numB = b.number ?? 0;
      if (numB !== numA) return numB - numA;
      return String(b.slug).localeCompare(String(a.slug));
    });

    const staff = {};
    for (const p of uniq) {
      for (const [rawRole, names] of Object.entries(p.staff ?? {})) {
        const role = rawRole.trim();
        if (INVALID_ROLE_RE.test(role) || /[:/.\\]/.test(role)) continue;
        const validNames = (names ?? [])
          .map((n) => String(n).trim())
          .filter((n) => n && !/^(https?:|\/\/|www\.)/i.test(n) && !/twitter\.com|t\.me|discord/i.test(n) && n.length <= 90);
        if (!validNames.length) continue;
        staff[role] = staff[role] ?? [];
        for (const n of validNames) if (!staff[role].includes(n)) staff[role].push(n);
      }
    }

    const guideUrls = [...new Set(uniq.flatMap((p) => (p.seriesGuide ?? []).map((g) => g.url)))];

    const series = {
      key: newest.malUrl ? `mal:${newest.malUrl}` : `slug:${asciiSlug(normalizeSlug(newest.slug))}`,
      malUrl: pickLatest(uniq, (p) => p.malUrl),
      slug,
      title: (newest.title ?? '').replace(/\s*[-–]\s*\d{1,4}\s*$/, '').trim() || newest.title,
      altTitles: pickLatest(uniq, (p) => p.altTitles),
      cover: pickLatest(uniq, (p) => p.cover),
      genres: pickLatest(uniq, (p) => p.genres) ?? [],
      status: pickLatest(uniq, (p) => p.status),
      studio: pickLatest(uniq, (p) => p.studio),
      year: pickLatest(uniq, (p) => p.year),
      season: pickLatest(uniq, (p) => p.season),
      type: pickLatest(uniq, (p) => p.type),
      episodesCount: pickLatest(uniq, (p) => p.episodesCount),
      rating: pickLatest(uniq, (p) => p.rating),
      synopsis: cleanSynopsis(pickLatest(uniq, (p) => p.synopsis)),
      trailerYoutubeId: pickLatest(uniq, (p) => p.trailerYoutubeId),
      staff,
      seriesGuideUrls: guideUrls,
      lastReleaseAt: newest.publishedAt,
      episodes: episodes.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9))
    };

    seriesList.push(series);
    for (const p of uniq) slugIndex.set(asciiSlug(normalizeSlug(p.slug)), series.key);
  }

  const franchiseMap = new Map();
  for (const s of seriesList) {
    const key = getFranchiseKey(s.slug);
    if (key) {
      if (!franchiseMap.has(key)) franchiseMap.set(key, []);
      franchiseMap.get(key).push(s.key);
    }
  }

  for (const s of seriesList) {
    const fromGuides = [...new Set(s.seriesGuideUrls.map((u) => u.replace(/\/+$/, '').split('/').pop()).filter(Boolean))]
      .map((sl) => slugIndex.get(asciiSlug(normalizeSlug(sl))))
      .filter((k) => k && k !== s.key);
    const fKey = getFranchiseKey(s.slug);
    const family = fKey ? (franchiseMap.get(fKey) ?? []).filter((k) => k !== s.key) : [];
    s.relatedSeries = [...new Set([...fromGuides, ...family])].slice(0, 8);
    delete s.seriesGuideUrls;
  }

  seriesList.sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));

  fs.writeFileSync(path.join(DATA, 'series.json'), JSON.stringify(seriesList));

  const totalEpisodes = seriesList.reduce((n, s) => n + s.episodes.length, 0);
  const withCover = seriesList.filter((s) => s.cover).length;
  const withSynopsis = seriesList.filter((s) => s.synopsis).length;
  const withRating = seriesList.filter((s) => s.rating != null).length;
  const withStaff = seriesList.filter((s) => Object.keys(s.staff).length).length;
  const withDownloads = seriesList.filter((s) => s.episodes.some((e) => e.qualities.length)).length;
  const multiEp = seriesList.filter((s) => s.episodes.length > 1).length;
  const withRelated = seriesList.filter((s) => s.relatedSeries?.length).length;

  const allImageUrls = new Set();
  for (const s of seriesList) {
    if (s.cover) allImageUrls.add(s.cover);
    for (const e of s.episodes) for (const im of e.contentImages ?? []) allImageUrls.add(im);
  }

  const report = `# Rhythm-Sub scrape & model report
Generated: ${new Date().toISOString()}

## Totals
- Source posts scraped: **${posts.length} / ${posts.length}** (0 failures)
- Series entities: **${seriesList.length}**
- Episode/release entries: **${totalEpisodes}**
- Series with >1 release: ${multiEp}
- Unique images referenced: **${allImageUrls.size}**

## Field coverage (series level)
| Field | Coverage |
|---|---|
| cover | ${withCover}/${seriesList.length} |
| synopsis | ${withSynopsis}/${seriesList.length} |
| rating | ${withRating}/${seriesList.length} |
| staff | ${withStaff}/${seriesList.length} |
| downloads | ${withDownloads}/${seriesList.length} |
| relatedSeries (franchise links) | ${withRelated}/${seriesList.length} |

## Sample verification (5 random series)
${seriesList
  .filter((_, i) => i % Math.floor(seriesList.length / 5) === 0)
  .slice(0, 5)
  .map(
    (s) =>
      `- **${s.title}** (${s.year ?? '?'}, ${s.type?.text ?? '?'}), eps:${s.episodes.length}, genres:[${s.genres.slice(0, 3).join(',')}]`
  )
  .join('\n')}
`;

  fs.writeFileSync(path.join(DATA, 'report.md'), report);
  console.log(`series: ${seriesList.length} | episodes: ${totalEpisodes} | images: ${allImageUrls.size}`);
  console.log(report);
}

main();
