import fs from 'node:fs';
import path from 'node:path';
import type { SitePage } from './types';
import { sanitizePageHtml } from './sanitize';
import { img, mapScrapedImageSrc, normalizeUpstreamImageUrl } from './images';
import { asciiSlug, normalizeSlug } from './slug';

/**
 * Static pages scraped from the upstream site (`data/pages/*.json`).
 *
 * The markup is untrusted: it is sanitized through an allowlist at load time
 * and every image is rewritten to a local asset, so the pages that render it
 * with `dangerouslySetInnerHTML` can never execute script or beacon to a
 * third-party host.
 */

let sitePages: Record<string, SitePage> = {};
let curatedProjectSlugs: string[] = [];
let siteSocials: { href: string; label: string }[] = [];

/**
 * Rewrite upstream WordPress image URLs that appear anywhere in the markup
 * (not only in <img src>) to their local asset. Kept as a whole-document pass
 * because upstream also links to wp-content assets from <a href>.
 */
function mapPageImages(html: string): string {
  return html.replace(
    /https?:\/\/(?:i\d\.wp\.com\/)?rhythm-sub\.com\/wp-content\/[^"')\s]+/g,
    (u) => img(normalizeUpstreamImageUrl(u))
  );
}

/**
 * Normalize WordPress card rows: mark paragraphs that hold a run of images so
 * CSS can lay them out as a clean centered flex row. Idempotent.
 */
function normalizeWpImgRows(html: string): string {
  return html.replace(
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
}

/** Load and sanitize every static page. Throws when the data directory is unusable. */
export function loadSitePages(dataRoot: string): {
  pages: Record<string, SitePage>;
  curatedProjectSlugs: string[];
  socials: { href: string; label: string }[];
} {
  const pages: Record<string, SitePage> = {};
  let curated: string[] = [];
  let socials: { href: string; label: string }[] = [];

  try {
    const pagesDir = path.join(dataRoot, 'pages');
    for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const p = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
      const key = p.key ?? f.replace(/\.json$/, '');
      const rawHtml = typeof p.contentHtml === 'string' ? p.contentHtml : '';
      // Detect the contact form in the RAW markup: sanitizePageHtml() strips
      // <form> entirely, so the flag must be captured before it runs.
      const hasForm = /<form[\s>]/i.test(rawHtml);
      // Store sanitized+mapped HTML so every consumer (including accidental
      // direct use of sitePage().contentHtml) gets safe output.
      const contentHtml = normalizeWpImgRows(mapPageImages(sanitizePageHtml(rawHtml, mapScrapedImageSrc)));
      pages[key] = {
        ...p,
        key,
        contentHtml,
        hasForm,
        images: (p.images ?? []).map((u: string) => img(u))
      };
    }

    const extras = JSON.parse(fs.readFileSync(path.join(pagesDir, '_home_extras.json'), 'utf8'));
    socials = extras.socials ?? [];
    curated = (extras.projectPostUrls ?? [])
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

  return { pages, curatedProjectSlugs: curated, socials };
}

// ── Module-level initialization (build-time only) ──────────────────────────
// Kept as a function so the data root is injected by the composition root
// instead of being resolved from process.cwd() here.

export function initSitePages(dataRoot: string): void {
  const loaded = loadSitePages(dataRoot);
  sitePages = loaded.pages;
  curatedProjectSlugs = loaded.curatedProjectSlugs;
  siteSocials = loaded.socials;
}

export function sitePage(key: string): SitePage | null {
  return sitePages[key] ?? null;
}

/**
 * Sanitize + localize a raw HTML fragment coming from scraped content.
 *
 * Only needed for markup that was NOT loaded through `loadSitePages` (e.g. a
 * one-off import); pages loaded from disk are already sanitized at load time.
 */
export function mappedHtml(html: string): string {
  // Scraped upstream markup is untrusted: sanitize through an allowlist before
  // it reaches dangerouslySetInnerHTML (stored XSS if the source is compromised).
  return normalizeWpImgRows(mapPageImages(sanitizePageHtml(html, mapScrapedImageSrc)));
}

export function getSocials(): { href: string; label: string }[] {
  return siteSocials;
}

export function getCuratedProjectSlugs(): string[] {
  return curatedProjectSlugs;
}
