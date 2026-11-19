import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllowedImage } from '../src/util.mjs';

const originalFetch = globalThis.fetch;
const restore = () => {
  globalThis.fetch = originalFetch;
};

const imageResponse = (ct = 'image/jpeg') =>
  new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
    status: 200,
    headers: ct ? { 'content-type': ct } : {}
  });

/**
 * fetchAllowedImage is the SSRF-hardened image fetcher: EVERY redirect hop is
 * re-validated against the host allowlist (rhythm-sub.com, www.rhythm-sub.com,
 * i0/i1/i2.wp.com), non-image content-types are refused, and the chain is
 * bounded. A default-follow fetch would let an allowlisted URL 30x straight
 * into http://169.254.169.254/... — these tests pin that it cannot.
 */

test('fetchAllowedImage refuses a disallowed initial host without fetching', async (t) => {
  t.after(restore);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return imageResponse();
  };
  await assert.rejects(
    fetchAllowedImage('https://evil.com/pic.jpg'),
    /host not allowed/
  );
  assert.equal(calls, 0);
});

test('fetchAllowedImage follows a redirect within the allowlist', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (requested.length === 1) {
      return new Response('', {
        status: 301,
        headers: { location: 'https://www.rhythm-sub.com/wp-content/uploads/pic.jpg' }
      });
    }
    return imageResponse();
  };
  const res = await fetchAllowedImage('https://rhythm-sub.com/wp-content/uploads/pic.jpg');
  assert.equal(res.status, 200);
  assert.deepEqual(requested, [
    'https://rhythm-sub.com/wp-content/uploads/pic.jpg',
    'https://www.rhythm-sub.com/wp-content/uploads/pic.jpg'
  ]);
});

test('fetchAllowedImage refuses a redirect to a disallowed host mid-chain', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response('', {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' }
    });
  };
  await assert.rejects(
    fetchAllowedImage('https://rhythm-sub.com/wp-content/uploads/pic.jpg'),
    /host not allowed/
  );
  assert.equal(requested.length, 1, 'the metadata endpoint must never be requested');
});

test('fetchAllowedImage refuses a non-image content-type (HTML block page)', async (t) => {
  t.after(restore);
  globalThis.fetch = async () =>
    new Response('<html>blocked</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  await assert.rejects(
    fetchAllowedImage('https://rhythm-sub.com/wp-content/uploads/pic.jpg'),
    /not an image/
  );
});

test('fetchAllowedImage accepts a 200 with no content-type header', async (t) => {
  t.after(restore);
  globalThis.fetch = async () => imageResponse('');
  const res = await fetchAllowedImage('https://i0.wp.com/rhythm-sub.com/pic.jpg');
  assert.equal(res.status, 200);
});

test('fetchAllowedImage throws on a non-200 final status', async (t) => {
  t.after(restore);
  globalThis.fetch = async () => new Response('gone', { status: 404 });
  await assert.rejects(
    fetchAllowedImage('https://rhythm-sub.com/wp-content/uploads/pic.jpg'),
    /HTTP 404/
  );
});

test('fetchAllowedImage bounds an endless redirect loop', async (t) => {
  t.after(restore);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('', {
      status: 302,
      headers: { location: 'https://rhythm-sub.com/loop.jpg' }
    });
  };
  await assert.rejects(
    fetchAllowedImage('https://rhythm-sub.com/loop.jpg', { maxRedirects: 2 }),
    /too many redirects/
  );
  assert.equal(calls, 3, 'hops 0..maxRedirects inclusive');
});

test('fetchAllowedImage sends the configured UA and Referer', async (t) => {
  t.after(restore);
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = opts;
    return imageResponse();
  };
  await fetchAllowedImage('https://rhythm-sub.com/pic.jpg', {
    referer: 'https://rhythm-sub.com/',
    ua: 'test-agent'
  });
  assert.equal(seen.headers['User-Agent'], 'test-agent');
  assert.equal(seen.headers.Referer, 'https://rhythm-sub.com/');
  assert.equal(seen.redirect, 'manual', 'redirects must be handled hop-by-hop, not by fetch');
});

test('fetchAllowedImage resolves a relative Location against the current URL', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (requested.length === 1) {
      return new Response('', { status: 302, headers: { location: '/moved/pic.jpg' } });
    }
    return imageResponse();
  };
  await fetchAllowedImage('https://rhythm-sub.com/wp-content/pic.jpg');
  assert.equal(requested[1], 'https://rhythm-sub.com/moved/pic.jpg');
});
