import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postForm, jar, usingInjectedCookie } from '../src/http.mjs';
import { reauthOrThrow } from '../src/login.mjs';

const originalFetch = globalThis.fetch;
const restore = () => {
  globalThis.fetch = originalFetch;
};

/**
 * Characterization tests for the remaining network-side functions that are
 * provable offline: postForm's request shape + cookie provenance rules, and
 * reauthOrThrow's injected-cookie branch (the operationally critical path in
 * CI, where wp-login.php is blocked for datacenter IPs).
 */

test('postForm sends a POST with form-encoded body, UA, Referer and manual redirects', async (t) => {
  t.after(restore);
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url: String(url), opts };
    return new Response('', { status: 200 });
  };
  const res = await postForm('https://rhythm-sub.com/wp-login.php', { log: 'user', pwd: 'p@ss' });
  assert.equal(res.status, 200);
  assert.equal(seen.url, 'https://rhythm-sub.com/wp-login.php');
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.body, 'log=user&pwd=p%40ss');
  assert.equal(seen.opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(seen.opts.headers.Referer, 'https://rhythm-sub.com/wp-login.php');
  assert.equal(seen.opts.redirect, 'manual');
});

test('postForm absorbs same-site Set-Cookie into the jar', async (t) => {
  t.after(restore);
  const saved = jar.map;
  t.after(() => {
    jar.map = saved;
  });
  jar.map = new Map();
  globalThis.fetch = async () =>
    new Response('', {
      status: 200,
      headers: [['set-cookie', 'wordpress_logged_in_x=abc123; Path=/; HttpOnly']]
    });
  await postForm('https://rhythm-sub.com/wp-login.php', { log: 'u', pwd: 'p' });
  assert.equal(jar.map.get('wordpress_logged_in_x'), 'abc123');
});

test('postForm never absorbs cookies from an off-site response', async (t) => {
  t.after(restore);
  const saved = jar.map;
  t.after(() => {
    jar.map = saved;
  });
  jar.map = new Map();
  globalThis.fetch = async () =>
    new Response('', {
      status: 200,
      headers: [['set-cookie', 'evil_session=stolen; Path=/']]
    });
  await postForm('https://evil.com/wp-login.php', { log: 'u', pwd: 'p' });
  assert.equal(jar.map.size, 0, 'off-site Set-Cookie must not enter the jar');
});

test('postForm sends jar cookies only to same-site URLs', async (t) => {
  t.after(restore);
  const saved = jar.map;
  t.after(() => {
    jar.map = saved;
  });
  jar.map = new Map([['session', 's3cret']]);
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    seen.push({ url: String(url), cookie: opts.headers.Cookie });
    return new Response('', { status: 200 });
  };
  await postForm('https://rhythm-sub.com/wp-login.php', {});
  await postForm('https://evil.com/collect', {});
  assert.equal(seen[0].cookie, 'session=s3cret');
  assert.equal(seen[1].cookie, undefined, 'the session cookie must never leak off-site');
});

test('usingInjectedCookie reflects the RHYTHM_COOKIE env var', (t) => {
  const saved = process.env.RHYTHM_COOKIE;
  t.after(() => {
    if (saved === undefined) delete process.env.RHYTHM_COOKIE;
    else process.env.RHYTHM_COOKIE = saved;
  });
  delete process.env.RHYTHM_COOKIE;
  assert.equal(usingInjectedCookie(), false);
  process.env.RHYTHM_COOKIE = 'a=1';
  assert.equal(usingInjectedCookie(), true);
});

test('reauthOrThrow in injected-cookie mode throws the actionable refresh message (no login attempt)', async (t) => {
  const saved = process.env.RHYTHM_COOKIE;
  t.after(() => {
    if (saved === undefined) delete process.env.RHYTHM_COOKIE;
    else process.env.RHYTHM_COOKIE = saved;
  });
  process.env.RHYTHM_COOKIE = 'a=1';
  // If this ever attempts a network login instead of throwing, the test
  // hangs/fails — the injected-cookie branch must short-circuit.
  await assert.rejects(
    reauthOrThrow(),
    (e) => /RHYTHM_COOKIE was rejected/.test(e.message) && /Refresh it/.test(e.message)
  );
});
