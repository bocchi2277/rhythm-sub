/**
 * TypeScript declarations for shared/rules.mjs (the scraper/site boundary
 * contract). The site imports the .mjs through bundler resolution; these
 * adjacent declarations give it full type safety without a build step.
 */

export declare const GENERIC_PREFIXES: Set<string>;
export declare function asciiSlug(raw: string): string;
export declare function normalizeSlug(slug: string): string;
export declare function getFranchiseKey(slug: string): string | null;
export declare function isInvalidRole(role: string): boolean;
export declare function cleanStaffRecord(
  staff: Record<string, string[]> | null | undefined
): Record<string, string[]>;
export declare function cleanSynopsis(s: string | null | undefined): string;

/** Structural subset of the site Episode / scraper episode objects. */
export interface EpisodeLike {
  slug: string;
  number: number | null;
  date: string | null;
}
export declare function compareEpisodesDesc(a: EpisodeLike, b: EpisodeLike): number;
