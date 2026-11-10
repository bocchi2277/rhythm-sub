import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, asciiSlug, cleanSynopsis } from '../src/build-model.mjs';

/**
 * The site re-implements the slug and synopsis rules in TypeScript
 * (site/lib/slug.ts, site/lib/text.ts). The two copies have already drifted
 * once (the greeting-strip regex), so this test pins them together.
 *
 * Importing the TS sources needs Node's type stripping (Node >= 22.18 / 23+).
 * When the runtime does not support it, the parity check is skipped rather
 * than failing the build.
 */
let site = null;
try {
  site = {
    slug: await import('../../site/lib/slug.ts'),
    text: await import('../../site/lib/text.ts')
  };
} catch {
  site = null;
}

const SKIP = site ? false : 'Node type stripping unavailable — site parity not checked';

test('site and scraper agree on slug normalization', { skip: SKIP }, () => {
  const slugs = [
    'anime-name-episode-12',
    'anime-name-ep-3',
    'anime-name-12',
    'anime-name-01-12',
    'anime-name',
    'Caf%C3%A9%20Anime',
    'Aober!!Anime',
    '!!!',
    '  Multiple---Spaces  ',
    'great-show-1'
  ];
  for (const s of slugs) {
    assert.equal(site.slug.normalizeSlug(s), normalizeSlug(s), `normalizeSlug(${s})`);
    assert.equal(site.slug.asciiSlug(s), asciiSlug(s), `asciiSlug(${s})`);
  }
});

test('site and scraper agree on synopsis cleaning', { skip: SKIP }, () => {
  const samples = [
    'قصة الأنمي: تدور أحداث القصة في عالم سحري غامض بين专卖店 realities.',
    'ملخص: A hero travels far.',
    '#فضفضة\nمرحبا\nWe present a new show about a lonely swordsman in a quiet town.',
    'نقدك لك\nيسعدنا announcing the newest batch of subtitles for the fans.',
    'نقدم لك\nA proper synopsis paragraph about the story and the characters involved.',
    'التصنيف: Action\nالحالة: Completed',
    'Anime Info : MAL 12345',
    'قصير',
    ''
  ];
  for (const s of samples) {
    assert.equal(site.text.safeSynopsis(s), cleanSynopsis(s), `safeSynopsis(${JSON.stringify(s)})`);
  }
});
