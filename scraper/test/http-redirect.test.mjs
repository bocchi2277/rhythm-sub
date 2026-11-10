import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPage } from '../src/http.mjs';

const originalFetch = globalThis.fetch;

function restore() {
  globalThis.fetch = originalFetch;
}

/**
 * The HTML we fetch is republished verbatim into data/posts/*.json ->
 * series.json -> the public site, so an off-site redirect must never be
 * followed: it would be an SSRF primitive (http://169.254.169.254/...) and a
 * content-injection vector.
 */
test('fetchPage does not follow a redirect to another host', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response('', {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' }
    });
  };

  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/');
  assert.equal(res.html, null, 'off-site redirect body must not be returned');
  assert.match(res.redirectedTo ?? '', /169\.254\.169\.254/);
  assert.equal(requested.length, 1, 'the off-site target must never be requested');
  assert.equal(requested[0], 'https://rhythm-sub.com/2024/01/02/post/');
});

test('fetchPage still follows a same-site redirect', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith('/post/')) {
      return new Response('', { status: 301, headers: { location: 'https://rhythm-sub.com/2024/01/02/post-final/' } });
    }
    return new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  };

  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/');
  assert.equal(res.status, 200);
  assert.match(res.html ?? '', /ok/);
  assert.deepEqual(requested, [
    'https://rhythm-sub.com/2024/01/02/post/',
    'https://rhythm-sub.com/2024/01/02/post-final/'
  ]);
});
