import sanitizeHtml from 'sanitize-html';

/**
 * Server-side allowlist sanitizer for HTML scraped from the upstream site.
 *
 * The about/support markup is committed to data/pages/*.json and rendered with
 * `dangerouslySetInnerHTML`, so it is untrusted input: if the upstream site is
 * ever compromised, the payload would otherwise execute in visitors' browsers
 * (stored XSS). Sanitize through an allowlist at the boundary instead.
 *
 * The asset mapper is injected by the caller (dependency inversion): this
 * module stays free of filesystem access, so it can be unit-tested directly.
 */

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'strike',
  'del',
  's',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'font',
  'sup',
  'sub',
  'center'
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan', 'align'],
  th: ['colspan', 'rowspan', 'align'],
  font: ['color', 'size', 'face'],
  '*': ['class', 'align']
};

/** Maps an <img src> found in untrusted markup to a safe, local URL. */
export type ImageMapper = (src: string | undefined) => string;

export const PAGE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // https only: plain-http links in scraped markup are dropped, not shipped.
  allowedSchemes: ['https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    // Every outbound link opens in a new tab with no opener/referrer leakage.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
    })
  },
  // Drop the *contents* of non-text containers, not just the tag.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'select', 'form', 'input', 'button']
};

// sanitize-html compiles the options on every call, so build them once per
// mapper instead of once per document.
const optionsCache = new WeakMap<ImageMapper, sanitizeHtml.IOptions>();

function optionsFor(mapImage: ImageMapper): sanitizeHtml.IOptions {
  let options = optionsCache.get(mapImage);
  if (!options) {
    options = {
      ...PAGE_SANITIZE_OPTIONS,
      transformTags: {
        ...PAGE_SANITIZE_OPTIONS.transformTags,
        // Images are resolved to a LOCAL asset. Without this, a compromised
        // upstream could embed <img src="https://evil.example/beacon.gif"> and
        // beacon every visitor (IP + referrer leak) from a first-party page.
        img: (tagName, attribs) => ({
          tagName,
          attribs: { ...attribs, src: mapImage(attribs.src) }
        })
      }
    };
    optionsCache.set(mapImage, options);
  }
  return options;
}

/**
 * Sanitize untrusted scraped markup.
 *
 * @param dirty    the raw markup
 * @param mapImage resolver for <img src> values (must return a local URL)
 */
export function sanitizePageHtml(dirty: string, mapImage: ImageMapper): string {
  return sanitizeHtml(dirty, optionsFor(mapImage));
}
