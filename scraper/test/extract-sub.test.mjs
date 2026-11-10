import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeOutputName } from '../src/extract-sub.mjs';

test('safeOutputName keeps normal names and sanitizes separators', () => {
  assert.equal(safeOutputName('My Batch'), 'My Batch');
  assert.equal(safeOutputName('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
  assert.equal(safeOutputName(''), 'Subtitles_Batch');
  assert.equal(safeOutputName(undefined), 'Subtitles_Batch');
});

test('safeOutputName rejects dot-only and whitespace-only names before any rmSync', () => {
  for (const bad of ['.', '..', '...', '   ', ' . ', '\t.\n']) {
    assert.throws(() => safeOutputName(bad), /Refusing unsafe output name/);
  }
});