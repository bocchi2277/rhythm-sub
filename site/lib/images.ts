import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Image asset resolution.
 *
 * Scraped content references upstream (WordPress) image URLs. The site ships
 * its own optimized WebP copies, so every remote URL is resolved through the
 * build-time manifest (`site/img-manifest.json`) to a local path.
 *
 * SERVER-ONLY: this module reads the filesystem. Client components must not
 * import it — use a local path that was already resolved on the server.
 */

// Resolve the site root from this module's location (site/lib/ -> site/)
// instead of process.cwd(), which is only correct when the build runs from site/.
const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Manifest = Record<string, string>;

let manifest: Manifest;
try {
  // Kept OUTSIDE public/ so the manifest (222KB of raw upstream URLs) is never
  // published into the static export — it is build-time data only.
  manifest = JSON.parse(fs.readFileSync(path.join(SITE_ROOT, 'img-manifest.json'), 'utf8'));
} catch (e) {
  throw new Error(`Failed to read img-manifest.json: ${(e as Error).message}`);
}

/**
 * Local path for a scraped image URL, or '/placeholder.svg' when the asset is
 * unknown. Never returns a remote URL: hotlinking would leak visitor IPs to
 * third-party hosts and break the CSP.
 */
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

// The WordPress Photon CDN form (i0.wp.com/rhythm-sub.com/...) is a different
// URL for the same asset as the origin form, and the manifest is keyed by the
// origin form — normalize before looking it up.
const PHOTON_PREFIX = /^(https?:\/\/)(i\d\.wp\.com\/)?rhythm-sub\.com/i;

/** Normalize an upstream image URL to the form the manifest is keyed by. */
export function normalizeUpstreamImageUrl(url: string): string {
  return url.replace(PHOTON_PREFIX, 'https://rhythm-sub.com').split('?')[0];
}

/**
 * Map an image URL found in scraped markup to a local site asset.
 *
 * Third-party absolute URLs are deliberately NOT proxied: a compromised
 * upstream could otherwise embed a tracking pixel that beacons every visitor
 * (IP + referrer leak) from a page that looks 100% first-party.
 */
export function mapScrapedImageSrc(src: string | null | undefined): string {
  if (!src) return '/placeholder.svg';
  const trimmed = src.trim();
  if (!trimmed) return '/placeholder.svg';
  // Already a local site asset — keep it.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  const normalized = normalizeUpstreamImageUrl(trimmed);
  if (normalized.startsWith('https://rhythm-sub.com/')) return img(normalized);
  // Anything else is a third-party host: do not load it.
  return '/placeholder.svg';
}
