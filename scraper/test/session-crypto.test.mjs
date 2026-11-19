import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptBuffer, decryptBuffer } from '../src/session-crypto.mjs';

const PASS = 'test-key-not-a-real-secret';
const PLAIN = Buffer.from(JSON.stringify({ wordpress_logged_in_abc: 'cookie-value' }));

test('session crypto round-trips', () => {
  const blob = encryptBuffer(PLAIN, PASS);
  assert.equal(blob.subarray(0, 4).toString(), 'RSC1');
  assert.deepEqual(decryptBuffer(blob, PASS), PLAIN);
});

test('session crypto uses a fresh salt and iv per encryption', () => {
  const a = encryptBuffer(PLAIN, PASS);
  const b = encryptBuffer(PLAIN, PASS);
  assert.notDeepEqual(a.subarray(4, 20), b.subarray(4, 20));
  assert.notDeepEqual(a.subarray(20, 32), b.subarray(20, 32));
  assert.notDeepEqual(a.subarray(48), b.subarray(48));
});

test('tampered ciphertext is rejected (AEAD, unlike the old CBC blob)', () => {
  const blob = encryptBuffer(PLAIN, PASS);
  blob[blob.length - 1] ^= 0x01;
  assert.throws(() => decryptBuffer(blob, PASS));
});

test('tampered auth tag is rejected', () => {
  const blob = encryptBuffer(PLAIN, PASS);
  blob[32] ^= 0x01;
  assert.throws(() => decryptBuffer(blob, PASS));
});

test('wrong key is rejected', () => {
  const blob = encryptBuffer(PLAIN, PASS);
  assert.throws(() => decryptBuffer(blob, 'another-key'));
});

test('truncated or foreign blobs are rejected', () => {
  const blob = encryptBuffer(PLAIN, PASS);
  assert.throws(() => decryptBuffer(blob.subarray(0, 40), PASS), /not an RSC1/);
  assert.throws(() => decryptBuffer(Buffer.from('Salted__legacy-cbc-blob'), PASS), /not an RSC1/);
  assert.throws(() => decryptBuffer(Buffer.alloc(0), PASS), /not an RSC1/);
});
