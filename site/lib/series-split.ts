import type { Episode, Series } from './types';
import { slugifySeries } from './slug';
import { tokenizeWork, workStem, workTitle } from './text';

/**
 * Split foreign-work posts filed under the wrong series.
 *
 * Source-data corruption happens: a scraper group keyed to one MAL entry can
 * absorb posts of a DIFFERENT show (real case: 8 "Kono Subarashii Sekai ni
 * Bakuen wo!" volume posts + 1 Mushoku-Tensei episode under a single object,
 * with the Bakuen MAL key but the Mushoku slug/title). Episodes whose title
 * shares ZERO meaningful tokens with the series' dominant title cannot be the
 * same work → regroup them into their own synthetic series.
 *
 * MUTATES the series objects it is given (their `episodes` array and `title`).
 */
export function splitForeignWorks(seriesList: Series[]): Series[] {
  const synthetics: Series[] = [];
  const knownSlugs = new Set(seriesList.map((s) => s.slug));

  for (const s of seriesList) {
    // Text that survives bracket stripping; a fully-tagged label ("[HEX][1080p
    // HEVC AAC]") falls back to its download-row name, which carries the real
    // work title.
    const textOf = (e: Episode): string => {
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
      const bucket = groups.get(st);
      if (bucket) bucket.push(e);
      else groups.set(st, [e]);
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
