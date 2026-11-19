import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseInventory,
  assertDiscovered,
  selectNewUrls,
  planInventoryWrite,
  assertPostsComplete,
  buildCommitMsg
} from '../src/sync.mjs';

/**
 * The inventory/safety policies of syncNewReleases, extracted as pure
 * functions so they are testable without network or git. Expected values
 * below are derived from the policies' documented intent (merge-never-shrink,
 * fail-loud discovery, partial-posts guard), not from re-running the code.
 */

test('parseInventory accepts a JSON array of URLs', () => {
  const r = parseInventory('["https://rhythm-sub.com/2024/01/02/a/","https://rhythm-sub.com/2024/01/02/b/"]');
  assert.equal(r.readable, true);
  // Boundary normalization: trailing slashes are stripped (see the
  // dedicated normalization test below for why).
  assert.deepEqual(r.urls, [
    'https://rhythm-sub.com/2024/01/02/a',
    'https://rhythm-sub.com/2024/01/02/b'
  ]);
});

test('parseInventory accepts an empty array as readable', () => {
  const r = parseInventory('[]');
  assert.equal(r.readable, true);
  assert.deepEqual(r.urls, []);
});

test('parseInventory normalizes trailing slashes to the inventory convention', () => {
  // recover once wrote slashed URLs; sync compares slash-less forms, so the
  // boundary must normalize or every slashed entry looks brand-new.
  const r = parseInventory('["https://rhythm-sub.com/2024/01/02/a/","https://rhythm-sub.com/2024/01/02/b"]');
  assert.equal(r.readable, true);
  assert.deepEqual(r.urls, [
    'https://rhythm-sub.com/2024/01/02/a',
    'https://rhythm-sub.com/2024/01/02/b'
  ]);
});

test('parseInventory rejects a non-array inventory with the documented reason', () => {
  const r = parseInventory('{"urls":[]}');
  assert.equal(r.readable, false);
  assert.deepEqual(r.urls, []);
  assert.equal(r.error, 'post_urls.json is not an array');
});

test('parseInventory rejects corrupt JSON without throwing', () => {
  const r = parseInventory('this is not json');
  assert.equal(r.readable, false);
  assert.deepEqual(r.urls, []);
  assert.ok(r.error && r.error.length > 0);
});

test('assertDiscovered throws the actionable bot-challenge error on zero links', () => {
  assert.throws(
    () => assertDiscovered([]),
    (e) =>
      /No post URLs discovered/.test(e.message) &&
      /bot-challenge/.test(e.message) &&
      /Refusing to report a healthy no-op/.test(e.message)
  );
});

test('assertDiscovered passes a non-empty discovery set', () => {
  assert.doesNotThrow(() => assertDiscovered(['https://rhythm-sub.com/2024/01/02/a/']));
});

test('selectNewUrls keeps unknown URLs and known URLs whose post file is missing', () => {
  const discovered = [
    'https://rhythm-sub.com/2024/01/02/known-present/',
    'https://rhythm-sub.com/2024/01/02/known-missing/',
    'https://rhythm-sub.com/2024/01/02/brand-new/'
  ];
  const existing = [discovered[0], discovered[1]];
  const seenSlugs = [];
  const postExists = (slug) => {
    seenSlugs.push(slug);
    return slug === 'known-present';
  };
  assert.deepEqual(selectNewUrls(discovered, existing, postExists), [discovered[1], discovered[2]]);
  // The existence probe must receive the post SLUG, not the full URL.
  assert.ok(seenSlugs.includes('known-present'));
  assert.ok(seenSlugs.includes('known-missing'));
});

test('selectNewUrls returns [] when everything is known and present', () => {
  const u = 'https://rhythm-sub.com/2024/01/02/a/';
  assert.deepEqual(selectNewUrls([u], [u], () => true), []);
});

test('planInventoryWrite merges and sorts when the inventory was readable', () => {
  const set = new Set(['https://rhythm-sub.com/2024/01/02/b/', 'https://rhythm-sub.com/2024/01/02/a/']);
  const plan = planInventoryWrite(set, true);
  assert.equal(plan.write, true);
  assert.deepEqual(plan.list, [
    'https://rhythm-sub.com/2024/01/02/a/',
    'https://rhythm-sub.com/2024/01/02/b/'
  ]);
});

test('planInventoryWrite NEVER shrinks: unreadable inventory means no write', () => {
  // The discovery set of one run (~3 pages + feed) must not overwrite 1000+ URLs.
  const partial = new Set(['https://rhythm-sub.com/2024/01/02/only-found-today/']);
  const plan = planInventoryWrite(partial, false);
  assert.equal(plan.write, false);
  assert.equal(plan.list, null);
});

test('assertPostsComplete refuses to rebuild from a partial POSTS_DIR', () => {
  assert.throws(
    () => assertPostsComplete(99, 100),
    /Refusing to rebuild: 99 post files but 100 known URLs/
  );
});

test('assertPostsComplete allows equal or greater post-file counts', () => {
  assert.doesNotThrow(() => assertPostsComplete(100, 100));
  assert.doesNotThrow(() => assertPostsComplete(101, 100));
});

test('buildCommitMsg joins up to three cleaned titles', () => {
  assert.equal(buildCommitMsg(['Episode A', 'Episode B']), 'Sync new release: Episode A, Episode B');
});

test('buildCommitMsg collapses whitespace and drops empty titles', () => {
  assert.equal(buildCommitMsg(['  Episode \n A  ', '', '   ']), 'Sync new release: Episode A');
});

test('buildCommitMsg summarizes overflow as (+N more)', () => {
  assert.equal(
    buildCommitMsg(['t1', 't2', 't3', 't4', 't5']),
    'Sync new release: t1, t2, t3 (+2 more)'
  );
});

test('buildCommitMsg with no usable titles keeps the prefix (pinned edge)', () => {
  assert.equal(buildCommitMsg([]), 'Sync new release: ');
  assert.equal(buildCommitMsg(['', '  ']), 'Sync new release: ');
});
