import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restAuthHeader, fetchRestInventory } from '../src/rest.mjs';
import { mergeDiscovery, isPostUrl } from '../src/sync.mjs';

/**
 * REST inventory discovery (application-password auth) merged into sync.
 * fetchRestInventory takes an injected fetchImpl so pagination/auth/error
 * handling are provable offline. The Basic-auth expected value is the
 * RFC 7617 example vector ('Aladdin:open sesame'), not a recomputation.
 */

const item = (n) => ({ slug: `post-${n}`, link: `https://rhythm-sub.com/2024/01/0${n}/post-${n}/`, date: `2024-01-0${n}T00:00:00` });

function fakeFetch(pages, totalPages, status = 200) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (status !== 200) return new Response('', { status });
    const page = Number(new URL(String(url)).searchParams.get('page'));
    return new Response(JSON.stringify(pages[page - 1] ?? []), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-wp-totalpages': String(totalPages) }
    });
  };
  return { impl, calls };
}

test('restAuthHeader produces the RFC 7617 Basic vector', () => {
  assert.equal(restAuthHeader('Aladdin', 'open sesame'), 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
});

test('fetchRestInventory paginates to x-wp-totalpages and sends the auth header', async () => {
  const { impl, calls } = fakeFetch([[item(1), item(2)], [item(3)]], 2);
  const posts = await fetchRestInventory({ user: 'Aladdin', appPassword: 'open sesame', fetchImpl: impl, sleepMs: 0 });
  assert.equal(posts.length, 3);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes('per_page=100'));
  assert.ok(calls[0].url.includes('page=1'));
  assert.ok(calls[1].url.includes('page=2'));
  assert.equal(calls[0].opts.headers.Authorization, 'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==');
});

test('fetchRestInventory stops at totalPages even if the server keeps offering data', async () => {
  const { impl, calls } = fakeFetch([[item(1)], [item(2)], [item(3)]], 1);
  const posts = await fetchRestInventory({ user: 'u', appPassword: 'p', fetchImpl: impl, sleepMs: 0 });
  assert.equal(posts.length, 1);
  assert.equal(calls.length, 1);
});

test('fetchRestInventory returns [] for an empty site', async () => {
  const { impl, calls } = fakeFetch([[]], 1);
  const posts = await fetchRestInventory({ user: 'u', appPassword: 'p', fetchImpl: impl, sleepMs: 0 });
  assert.deepEqual(posts, []);
  assert.equal(calls.length, 1);
});

test('fetchRestInventory throws with the status on auth failure', async () => {
  const { impl } = fakeFetch([], 1, 401);
  await assert.rejects(
    fetchRestInventory({ user: 'u', appPassword: 'bad', fetchImpl: impl, sleepMs: 0 }),
    /HTTP 401/
  );
});

test('fetchRestInventory requires both credentials', async () => {
  await assert.rejects(fetchRestInventory({ user: '', appPassword: 'p' }), /requires/);
  await assert.rejects(fetchRestInventory({ user: 'u', appPassword: '' }), /requires/);
});

test('fetchRestInventory rejects a non-array payload', async () => {
  const impl = async () => new Response(JSON.stringify({ code: 'rest_forbidden' }), { status: 200, headers: { 'x-wp-totalpages': '1' } });
  await assert.rejects(
    fetchRestInventory({ user: 'u', appPassword: 'p', fetchImpl: impl, sleepMs: 0 }),
    /unexpected payload/
  );
});

test('mergeDiscovery dedupes, strips trailing slashes and sorts', () => {
  const homepage = ['https://rhythm-sub.com/2024/01/02/b', 'https://rhythm-sub.com/2024/01/01/a'];
  const rest = ['https://rhythm-sub.com/2024/01/02/b/', 'https://rhythm-sub.com/2024/01/03/c/'];
  assert.deepEqual(mergeDiscovery(homepage, rest), [
    'https://rhythm-sub.com/2024/01/01/a',
    'https://rhythm-sub.com/2024/01/02/b',
    'https://rhythm-sub.com/2024/01/03/c'
  ]);
});

test('isPostUrl accepts dated permalinks on the source host only', () => {
  assert.equal(isPostUrl('https://rhythm-sub.com/2024/01/02/post/'), true);
  assert.equal(isPostUrl('http://rhythm-sub.com/2024/01/02/post'), true);
  assert.equal(isPostUrl('https://rhythm-sub.com/2024/01/02/'), false, 'needs a slug segment');
  assert.equal(isPostUrl('https://rhythm-sub.com/wp-content/uploads/2024/01/02/x.jpg'), false);
  assert.equal(isPostUrl('https://rhythm-sub.com/page/2/'), false);
});

test('isPostUrl rejects host lookalikes and substring tricks (URL-parsed, not substring)', () => {
  assert.equal(isPostUrl('https://evil.com/2024/01/02/post/'), false);
  assert.equal(isPostUrl('https://rhythm-sub.com.evil.com/2024/01/02/post/'), false);
  assert.equal(isPostUrl('https://evil.com/?x=https://rhythm-sub.com/2024/01/02/post/'), false);
  assert.equal(isPostUrl('ftp://rhythm-sub.com/2024/01/02/post/'), false);
  assert.equal(isPostUrl('not a url'), false);
});
