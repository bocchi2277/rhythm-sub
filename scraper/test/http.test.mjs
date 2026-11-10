import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs } from '../src/http.mjs';

const headersWith = (value) => ({ get: (name) => (name.toLowerCase() === 'retry-after' ? value : null) });

test('retryDelayMs uses bounded exponential backoff without Retry-After', () => {
  assert.equal(retryDelayMs(null, 0), 1000);
  assert.equal(retryDelayMs(null, 1), 2000);
  assert.equal(retryDelayMs(null, 2), 4000);
  assert.equal(retryDelayMs(null, 20), 30000); // capped
  assert.equal(retryDelayMs(headersWith(null), 0), 1000);
});

test('retryDelayMs honors Retry-After delta-seconds', () => {
  assert.equal(retryDelayMs(headersWith('2'), 0), 2000);
  assert.equal(retryDelayMs(headersWith('0'), 0), 0);
  assert.equal(retryDelayMs(headersWith('0.5'), 0), 500);
});

test('retryDelayMs caps hostile Retry-After values', () => {
  assert.equal(retryDelayMs(headersWith('999999'), 0), 60000);
});

test('retryDelayMs parses HTTP-date Retry-After within bounds', () => {
  const future = new Date(Date.now() + 5000).toUTCString();
  const delay = retryDelayMs(headersWith(future), 0);
  assert.ok(delay >= 0 && delay <= 60000);
  const past = new Date(Date.now() - 60000).toUTCString();
  assert.equal(retryDelayMs(headersWith(past), 0), 0);
});

test('retryDelayMs falls back to backoff for unparseable Retry-After', () => {
  assert.equal(retryDelayMs(headersWith('not-a-date'), 1), 2000);
  assert.equal(retryDelayMs(headersWith('-5'), 0), 1000);
});