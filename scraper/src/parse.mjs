import * as cheerio from 'cheerio';
import { photonToOrigin, slugFromUrl } from './util.mjs';

function textWithBreaks($, el) {
  const $clone = $(el).clone();
  $clone.find('br').replaceWith('\n');
  return $clone
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const ROLE_RE = /^([A-Za-z][A-Za-z &+'-]{0,24})\s*[:：]/;
const INVALID_ROLE_RE = /^(https?|ftp|www|anime\s*info|http)$/i;

function parseStaffLine(rawLine) {
  const clean = rawLine.replace(/\s+/g, ' ').trim();
  const m = clean.match(ROLE_RE);
  if (!m) return null;
  const role = m[1].trim();
  if (INVALID_ROLE_RE.test(role) || /[:/.\\]/.test(role)) return null;

  let rest = clean.slice(m[0].length);

  const nextRole = rest.slice(1).match(new RegExp(`[A-Za-z][A-Za-z &+'-]{0,24}\\s*[:：]`, 'g'));
  if (nextRole && nextRole.length) {
    let cutAt = -1;
    for (const cand of nextRole) {
      const idx = rest.indexOf(cand, 1);
      if (idx > 0 && (cutAt === -1 || idx < cutAt)) cutAt = idx;
    }
    if (cutAt > 0) rest = rest.slice(0, cutAt);
  }

  const value = rest.replace(/\s+/g, ' ').trim();
  if (!role || !value || /^(https?:|\/\/|www\.)/i.test(value) || /twitter\.com|t\.me|discord/i.test(value) || value.length > 90) return null;
  return { role, value };
}

function extractSections($) {
  const $root = $('.entry-content');
  const out = { synopsis: '', staff: {}, malUrl: null, seriesGuide: [] };
  let mode = null;
  let sawHr = false;
  const preHrTexts = [];

  const $container = $root.find('.mctnx').first();
  const children = ($container.length ? $container : $root).children().toArray();

  for (const el of children) {
    const $el = $(el);
    if (el.tagName === 'hr') {
      sawHr = true;
      mode = null;
      continue;
    }
    const txt = $el.text();

    if (!sawHr && mode === null && txt.trim().length >= 30) {
      preHrTexts.push(textWithBreaks($, $el));
    }

    if (/دليل\s*سلسلة/.test(txt)) {
      mode = 'guide';
      $el.find('a[href]').each((_, a) => {
        const href = $(a).attr('href') ?? '';
        if (/rhythm-sub\.com\/20\d{2}\//.test(href)) {
          out.seriesGuide.push({ title: $(a).text().trim(), url: href.split('#')[0].replace(/\/+$/, '') });
        }
      });
      continue;
    }
    if (/قصة\s*الأنمي/.test(txt) && txt.length < 40) {
      mode = 'story';
      continue;
    }
    if (/العاملون\s*على\s*المشروع/.test(txt)) {
      mode = 'staff';
      continue;
    }

    if (mode === 'story') {
      const t = textWithBreaks($, el);
      if (t) out.synopsis = out.synopsis ? `${out.synopsis}\n${t}` : t;
    } else if (mode === 'staff') {
      for (const line of textWithBreaks($, el).split('\n')) {
        const parsed = parseStaffLine(line);
        if (!parsed) continue;
        const { role, value } = parsed;
        $el.find("a[href*='myanimelist.net']").each((_, a) => {
          out.malUrl = $(a).attr('href') ?? out.malUrl;
        });
        out.staff[role] = out.staff[role] ?? [];
        if (!out.staff[role].includes(value)) out.staff[role].push(value);
      }
    } else if (mode === 'guide') {
      $el.find('a[href]').each((_, a) => {
        const href = $(a).attr('href') ?? '';
        if (/rhythm-sub\.com\/20\d{2}\//.test(href)) {
          out.seriesGuide.push({ title: $(a).text().trim(), url: href.split('#')[0].replace(/\/+$/, '') });
        }
      });
    }
  }

  out.seriesGuide = Object.values(
    Object.fromEntries(out.seriesGuide.map((g) => [g.url, g]))
  );

  if (!out.synopsis && !sawHr) {
    out.synopsis = preHrTexts.filter((t) => t.length >= 30).join('\n');
  } else if (!out.synopsis) {
    const firstBig = children
      .filter((el) => el.tagName !== 'hr')
      .map((el) => textWithBreaks($, $(el)))
      .find((t) => t.length >= 40 && !/دليل|العاملون|Anime Info/.test(t));
    out.synopsis = firstBig ?? '';
  }

  if (Object.keys(out.staff).length === 0) {
    for (const el of children) {
      const lines = textWithBreaks($, $(el)).split('\n');
      for (const line of lines) {
        const parsed = parseStaffLine(line);
        if (!parsed) continue;
        out.staff[parsed.role] = out.staff[parsed.role] ?? [];
        if (!out.staff[parsed.role].includes(parsed.value)) out.staff[parsed.role].push(parsed.value);
      }
    }
  }

  if (!out.malUrl) {
    out.malUrl =
      $root.find("a[href*='myanimelist.net']").first().attr('href') ??
      ($root.html()?.match(/https:\/\/myanimelist\.net\/anime\/\d+[^\s"'<]*/) ?? [null])[0];
  }

  return out;
}

export function parsePost(html, url) {
  const $ = cheerio.load(html);
  const slug = slugFromUrl(url);

  const title = $('h1.entry-title').first().text().trim();
  const altTitles = ($('span.alter').first().text() ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const cover = photonToOrigin($('img.entry-image.wp-post-image').first().attr('src'));
  const author = $('.entry-author-name').first().text().trim();
  const publishedAt = $('time.entry-date.published').attr('datetime') ?? null;
  const postId = $('div.bookmark[data-id]').first().attr('data-id') ?? null;

  let rating = null;
  const cr = parseFloat($('select.score').first().attr('data-current-rating') ?? '');
  if (!Number.isNaN(cr)) rating = Math.round(cr * 2 * 100) / 100;
  else {
    const rt = ($('.rating strong').first().text() ?? '').match(/([\d.]+)/);
    if (rt) rating = parseFloat(rt[1]);
  }

  const meta = { genres: [], season: null, type: null };
  $('ul.spe li').each((_, li) => {
    const label = ($(li).find('b').first().text() ?? '').replace(/[:：]\s*$/, '').trim();
    const val = ($(li).clone().children('b').remove().end().text() ?? '').trim();

    if (label === 'التصنيف') {
      meta.genres = $(li)
        .find("a[rel='tag'][href*='/tag/']")
        .map((__, a) => $(a).text().trim())
        .get()
        .filter(Boolean);
    } else if (label === 'الحالة') meta.status = val || null;
    else if (label === 'استوديو') meta.studio = ($(li).find('a').first().text() || val).trim() || null;
    else if (label === 'سنة الإصدار') meta.year = parseInt(val.match(/\d{4}/)?.[0] ?? '', 10) || null;
    else if (label === 'الموسم') {
      const a = $(li).find("a[href*='/season/']");
      meta.season = { text: (a.first().text() || val).trim(), slug: a.attr('href')?.match(/season\/([^/]+)/)?.[1] ?? null };
    } else if (label === 'النوع') {
      const a = $(li).find("a[href*='/category/']");
      meta.type = { text: (a.first().text() || val).trim(), slug: a.attr('href')?.match(/category\/([^/]+)/)?.[1] ?? null };
    } else if (label === 'الحلقات') meta.episodesCount = parseInt(val.match(/\d+/)?.[0] ?? '', 10) || null;
  });

  let trailerYoutubeId = null;
  const yt = $("iframe[src*='youtube'], iframe[src*='youtu.be']").first().attr('src') ?? '';
  const ytm = yt.match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/);
  if (ytm) trailerYoutubeId = ytm[1];

  const downloads = [];
  $('.soraddl').each((_, box) => {
    const $box = $(box);
    const label = $box.find('.sorattl h3').first().text().trim();
    const qualities = [];
    $box.find('.soraurl').each((__, row) => {
      const quality = ($(row).find('a.res').first().text() ?? '').trim();
      const links = $(row)
        .find('a[href]')
        .not('.res')
        .map((___, a) => ({ name: ($(a).text() ?? '').trim(), url: $(a).attr('href') }))
        .get()
        .filter((l) => l.name && l.url);
      if (quality || links.length) qualities.push({ quality, links });
    });
    downloads.push({ label, qualities });
  });

  const sections = extractSections($);

  const contentImages = [...new Set($('.entry-content img[src]').map((_, im) => photonToOrigin($(im).attr('src'))).get())];

  const relatedPosts = [
    ...new Set(
      $('.entry-content a[href]')
        .map((_, a) => $(a).attr('href') ?? '')
        .get()
        .filter((h) => /^https?:\/\/rhythm-sub\.com\/20\d{2}\//.test(h))
        .map((h) => h.split('#')[0].replace(/\/+$/, ''))
    )
  ];

  return {
    url,
    slug,
    postId,
    title,
    altTitles,
    author,
    publishedAt,
    rating,
    cover,
    genres: meta.genres,
    status: meta.status ?? null,
    studio: meta.studio ?? null,
    year: meta.year ?? null,
    season: meta.season,
    type: meta.type,
    episodesCount: meta.episodesCount ?? null,
    trailerYoutubeId,
    synopsis: sections.synopsis,
    staff: sections.staff,
    malUrl: sections.malUrl,
    seriesGuide: sections.seriesGuide,
    downloads,
    contentImages,
    relatedPosts,
    contentHtml: $('.entry-content').first().html()?.trim() ?? ''
  };
}
