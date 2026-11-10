import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The site's HTML allowlist (site/lib/sanitize.ts) is the last line of
 * defence for markup rendered with dangerouslySetInnerHTML. It lives in the
 * site package, so it is exercised from here through Node's type stripping
 * (Node >= 22.18 / 23+). When the runtime does not support it, the checks are
 * skipped rather than failing the build.
 */
let sanitizePageHtml = null;
let mapScrapedImageSrc = null;
try {
  ({ sanitizePageHtml } = await import('../../site/lib/sanitize.ts'));
  ({ mapScrapedImageSrc } = await import('../../site/lib/images.ts'));
} catch {
  sanitizePageHtml = null;
}

const SKIP = sanitizePageHtml ? false : 'Node type stripping unavailable — sanitizer not checked';
const clean = (html) => sanitizePageHtml(html, mapScrapedImageSrc);

test('sanitizer drops script vectors', { skip: SKIP }, () => {
  assert.equal(clean('<script>alert(1)</script>'), '');
  assert.equal(clean('<img src=x onerror=alert(1)>'), '<img src="/placeholder.svg" />');
  assert.equal(clean('<svg><script>alert(1)</script></svg>'), '');
  assert.equal(clean('<iframe src="https://evil.example"></iframe>'), '');
  assert.equal(clean('<p style="background:url(javascript:alert(1))">x</p>'), '<p>x</p>');
  // mXSS / mutation payload
  assert.ok(!clean('<math><mtext><table><mglyph><style><img src onerror=alert(1)>').includes('onerror'));
});

test('sanitizer strips javascript: and protocol-relative hrefs', { skip: SKIP }, () => {
  assert.equal(clean('<a href="javascript:alert(1)">x</a>'), '<a target="_blank" rel="noopener noreferrer nofollow">x</a>');
  assert.equal(clean('<a href="JaVaScRiPt:alert(1)">x</a>'), '<a target="_blank" rel="noopener noreferrer nofollow">x</a>');
  assert.equal(clean('<a href="//evil.example">x</a>'), '<a target="_blank" rel="noopener noreferrer nofollow">x</a>');
});

test('sanitizer drops the contents of forms', { skip: SKIP }, () => {
  assert.equal(clean('<form action="https://evil.example"><input name="a"></form>'), '');
});

test('sanitizer rewrites third-party images to a local asset', { skip: SKIP }, () => {
  // A compromised upstream must not be able to beacon visitors.
  const out = clean('<img src="https://evil.example/beacon.gif">');
  assert.ok(!out.includes('evil.example'), out);
  assert.ok(out.includes('/placeholder.svg'), out);

  // A local asset stays untouched.
  assert.ok(clean('<img src="/img/local.webp">').includes('/img/local.webp'));
});
