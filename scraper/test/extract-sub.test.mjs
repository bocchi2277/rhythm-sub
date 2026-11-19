import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeOutputName, safeTrackLang } from '../src/extract-sub.mjs';

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

test('safeTrackLang allowlists BCP-47-ish tags and neutralizes traversal', () => {
  // Regression: the raw mkvmerge language field flowed into path.join, so
  // '../../../pwned' escaped the output bundle directory.
  assert.equal(safeTrackLang('ara'), 'ara');
  assert.equal(safeTrackLang('en-US'), 'en-US');
  assert.equal(safeTrackLang('zh-Hans'), 'zh-Hans');
  assert.equal(safeTrackLang('../../../pwned'), 'und');
  assert.equal(safeTrackLang('..\\..\\x'), 'und');
  assert.equal(safeTrackLang('a/b'), 'und');
  assert.equal(safeTrackLang('x'.repeat(33)), 'und');
  assert.equal(safeTrackLang(''), 'und');
  assert.equal(safeTrackLang(undefined), 'und');
  assert.equal(safeTrackLang(null), 'und');
});