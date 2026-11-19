import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPage, jar } from '../src/http.mjs';

const originalFetch = globalThis.fetch;
const restore = () => {
  globalThis.fetch = originalFetch;
};

/**
 * fetchPage guards beyond the off-site-redirect rule (covered in
 * http-redirect.test.mjs): wp-login surfacing, non-http schemes, bounded
 * retries on 5xx/429, and the redirect-depth cap.
 */

test('fetchPage surfaces a wp-login redirect instead of following it', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response('', {
      status: 302,
      headers: { location: 'https://rhythm-sub.com/wp-login.php?redirect_to=x' }
    });
  };
  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/');
  assert.equal(res.html, null);
  assert.match(res.redirectedTo ?? '', /wp-login/);
  assert.equal(requested.length, 1, 'wp-login must never be fetched by fetchPage');
});

test('fetchPage surfaces a non-http(s) redirect scheme without following it', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response('', { status: 302, headers: { location: 'javascript:alert(1)' } });
  };
  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/');
  assert.equal(res.html, null);
  assert.match(res.redirectedTo ?? '', /^javascript:/);
  assert.equal(requested.length, 1);
});

test('fetchPage retries a 503 and succeeds on the next attempt', async (t) => {
  t.after(restore);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) {
      // Retry-After: 0 keeps the test instant while exercising the header path.
      return new Response('busy', { status: 503, headers: { 'retry-after': '0' } });
    }
    return new Response('<html>ok</html>', { status: 200 });
  };
  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/', { tries: 2 });
  assert.equal(res.status, 200);
  assert.match(res.html ?? '', /ok/);
  assert.equal(calls, 2);
});

test('fetchPage returns the last 503 body when tries are exhausted', async (t) => {
  t.after(restore);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('still busy', { status: 503, headers: { 'retry-after': '0' } });
  };
  const res = await fetchPage('https://rhythm-sub.com/2024/01/02/post/', { tries: 2 });
  assert.equal(res.status, 503);
  assert.equal(calls, 2);
});

test('fetchPage caps the same-site redirect chain at depth 5', async (t) => {
  t.after(restore);
  const requested = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    requested.push(u);
    const n = Number(u.match(/\/r(\d+)\//)?.[1] ?? 0);
    return new Response('', {
      status: 302,
      headers: { location: `https://rhythm-sub.com/r${n + 1}/` }
    });
  };
  const res = await fetchPage('https://rhythm-sub.com/r0/');
  assert.equal(res.html, null, 'an endless chain must surface, not loop');
  // initial request + 5 followed hops (depth 0..5), the 6th redirect surfaces
  assert.equal(requested.length, 6);
  assert.match(res.redirectedTo ?? '', /\/r6\//);
});

/**
 * jar cookie handling — pure Map operations only. jar.load() reads the real
 * session file and is deliberately NOT exercised here.
 */

test('jar.absorb stores cookie pairs and ignores attributes', (t) => {
  const saved = jar.map;
  t.after(() => {
    jar.map = saved;
  });
  jar.map = new Map();
  const res = new Response('', {
    headers: [
      ['set-cookie', 'wordpress_logged_in_x=abc123; Path=/; HttpOnly'],
      ['set-cookie', 'other=def; Expires=Wed, 01 Jan 2025 00:00:00 GMT']
    ]
  });
  jar.absorb(res);
  assert.equal(jar.map.get('wordpress_logged_in_x'), 'abc123');
  assert.equal(jar.map.get('other'), 'def');
  assert.equal(jar.header(), 'wordpress_logged_in_x=abc123; other=def');
  assert.equal(jar.has('wordpress_logged_in'), true);
  assert.equal(jar.has('missing_prefix'), false);
});

test('jar.absorb skips malformed set-cookie lines', (t) => {
  const saved = jar.map;
  t.after(() => {
    jar.map = saved;
  });
  jar.map = new Map();
  const res = new Response('', {
    headers: [
      ['set-cookie', 'novalue'],
      ['set-cookie', '=emptyname'],
      ['set-cookie', 'good=1']
    ]
  });
  jar.absorb(res);
  assert.equal(jar.map.size, 1);
  assert.equal(jar.map.get('good'), '1');
});
