import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSocialUrl } from '../src/fetch-home-extras.mjs';

test('isSocialUrl accepts the real team channels over https', () => {
  assert.equal(isSocialUrl('https://twitter.com/Rhythmsub'), true);
  assert.equal(isSocialUrl('https://discord.gg/mjQzPJk'), true);
  assert.equal(isSocialUrl('https://t.me/RhythmSub'), true);
  assert.equal(isSocialUrl('https://www.youtube.com/@rhythm'), true);
});

test('isSocialUrl rejects substring smuggles and non-https schemes', () => {
  // Regression: the old substring regex accepted these as "official channels"
  // (stored phishing if the upstream homepage is compromised).
  assert.equal(isSocialUrl('https://evil.example/?t.me'), false);
  assert.equal(isSocialUrl('https://evil.example/#twitter.com'), false);
  assert.equal(isSocialUrl('https://t.me.evil.com/x'), false);
  assert.equal(isSocialUrl('https://evil.example/discord.gg'), false);
  assert.equal(isSocialUrl('javascript:alert(1)//t.me'), false);
  assert.equal(isSocialUrl('http://t.me/x'), false);
  assert.equal(isSocialUrl('//t.me/x'), false);
  assert.equal(isSocialUrl('not a url'), false);
  assert.equal(isSocialUrl(''), false);
});
