/**
 * Shared domain types for the scraped series model.
 *
 * Kept in their own module (no I/O, no logic) so that both the data layer
 * and the pure helpers (slug/text/split) can depend on them without creating
 * an import cycle back through `lib/data.ts`.
 */

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

export type SitePage = {
  key: string;
  url: string;
  title: string;
  contentHtml: string;
  images: string[];
  /** Detected in the RAW markup before sanitization (which strips <form>). */
  hasForm?: boolean;
};
