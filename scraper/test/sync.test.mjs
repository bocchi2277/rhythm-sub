import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUrls } from '../src/sync.mjs';

/**
 * extractUrls is the discovery parser behind sync's "zero links = bot
 * challenge = fail loud" guard. These tests pin exactly what it recognizes
 * (dated post permalinks), where a URL token ends (quotes, angle brackets,
 * whitespace, fragment), and that non-post URLs never enter the inventory.
 */

test('extractUrls pulls dated post permalinks out of anchor markup', () => {
  const html = `<a href="https://rhythm-sub.com/2024/01/02/episode-5/">x</a>
    <a href='https://rhythm-sub.com/2025/11/09/another-post/'>y</a>`;
  assert.deepEqual(extractUrls(html), [
    'https://rhythm-sub.com/2024/01/02/episode-5',
    'https://rhythm-sub.com/2025/11/09/another-post'
  ]);
});

test('extractUrls deduplicates repeated links and strips trailing slashes', () => {
  const html = `https://rhythm-sub.com/2024/01/02/post/
    https://rhythm-sub.com/2024/01/02/post///
    https://rhythm-sub.com/2024/01/02/post`;
  assert.deepEqual(extractUrls(html), ['https://rhythm-sub.com/2024/01/02/post']);
});

test('extractUrls stops the token at quote, angle bracket, whitespace and fragment', () => {
  const html = `<a href="https://rhythm-sub.com/2024/01/02/post/#comments">c</a>
    <img src="https://rhythm-sub.com/2024/01/02/post/cover.jpg">
    text https://rhythm-sub.com/2024/01/02/post/ tail`;
  const urls = extractUrls(html);
  assert.ok(urls.includes('https://rhythm-sub.com/2024/01/02/post'));
  // The fragment must not leak into the inventory URL.
  assert.ok(!urls.some((u) => u.includes('#')));
  // The img src is a dated-path URL too; it is captured up to the quote.
  assert.ok(urls.includes('https://rhythm-sub.com/2024/01/02/post/cover.jpg'));
});

test('extractUrls ignores non-post URLs (uploads, pagination, other hosts)', () => {
  const html = `https://rhythm-sub.com/wp-content/uploads/2024/01/02/img.jpg
    https://rhythm-sub.com/page/2/
    https://rhythm-sub.com/about/
    https://evil.com/2024/01/02/post/
    https://rhythm-sub.com.evil.com/2024/01/02/post/`;
  assert.deepEqual(extractUrls(html), []);
});

test('extractUrls returns [] for a bot-challenge page with no post links', () => {
  const challenge = '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>';
  assert.deepEqual(extractUrls(challenge), []);
});

test('extractUrls reads permalinks out of RSS <link> elements', () => {
  const feed = `<?xml version="1.0"?><rss><channel>
    <item><link>https://rhythm-sub.com/2024/03/04/feed-post/</link></item>
  </channel></rss>`;
  assert.deepEqual(extractUrls(feed), ['https://rhythm-sub.com/2024/03/04/feed-post']);
});

test('extractUrls matches http as well as https and only 20xx years', () => {
  const html = `http://rhythm-sub.com/2024/01/02/plain-http/
    https://rhythm-sub.com/1999/01/02/old/
    https://rhythm-sub.com/2099/12/31/future/`;
  assert.deepEqual(extractUrls(html), [
    'http://rhythm-sub.com/2024/01/02/plain-http',
    'https://rhythm-sub.com/2099/12/31/future'
  ]);
});

test('extractUrls requires a slug segment after the date', () => {
  // [^"'#<>\\s]+ needs at least one character after the date path.
  assert.deepEqual(extractUrls('https://rhythm-sub.com/2024/01/02/'), []);
});

test('extractUrls tolerates empty and link-free input', () => {
  assert.deepEqual(extractUrls(''), []);
  assert.deepEqual(extractUrls('<html><body>nothing here</body></html>'), []);
});
