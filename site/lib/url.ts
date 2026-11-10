/**
 * Allowlist-based URL sanitizer, safe to import from client components.
 *
 * Every href rendered from scraped or team-supplied data (download links,
 * covers, social links) must pass through this: React escapes attribute
 * *syntax* but does NOT block `javascript:` URLs, so an attacker-controlled
 * link in the upstream content would otherwise execute in visitors' browsers
 * on click (XSS). Allowed: http, https, magnet (torrent) and mailto.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'magnet:', 'mailto:']);

/** Returns a safe absolute URL, or null when the input is missing/unsafe. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const trimmed = String(u).trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    // Base handles protocol-relative and relative values; only absolute
    // http(s)/magnet/mailto results survive.
    const parsed = new URL(trimmed, 'https://invalid.invalid/');
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.protocol === 'magnet:' || parsed.protocol === 'mailto:') return trimmed;
    if (parsed.hostname === 'invalid.invalid') return null; // was a relative path, not a URL
    return parsed.href;
  } catch {
    return null;
  }
}
