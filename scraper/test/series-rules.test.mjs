import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSlug,
  asciiSlug,
  cleanSynopsis,
  getFranchiseKey,
  compareEpisodesDesc,
  cleanStaffRecord
} from '../src/build-model.mjs';

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
    text: await import('../../site/lib/text.ts'),
    episodes: await import('../../site/lib/episodes.ts')
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

test('site and scraper agree on franchise keys', { skip: SKIP }, () => {
  const slugs = [
    'great-show-2019',
    'kono-sekai-ni-shukufuku-wo',
    'princess-principal-crown-handler-movie',
    'one',
    'yuusha-yamada',
    'a-b',
    'isekai-quartet-movie'
  ];
  for (const s of slugs) {
    assert.equal(site.slug.getFranchiseKey(s), getFranchiseKey(s), `getFranchiseKey(${s})`);
  }
});

test('site and scraper agree on episode ordering', { skip: SKIP }, () => {
  const eps = [
    { slug: 'a-1', number: 1, date: '2024-01-01' },
    { slug: 'a-2', number: 2, date: '2024-01-08' },
    { slug: 'a-bd', number: 9999, date: null },
    { slug: 'a-3', number: 3, date: null },
    { slug: 'a-2b', number: 2, date: '2024-01-08' }
  ];
  const siteSorted = [...eps].sort(site.episodes.compareEpisodesDesc).map((e) => e.slug);
  const scraperSorted = [...eps].sort(compareEpisodesDesc).map((e) => e.slug);
  assert.deepEqual(siteSorted, scraperSorted);
});

test('site and scraper agree on staff cleaning', { skip: SKIP }, () => {
  const samples = [
    {
      TL: [' Alice ', 'https://evil.example'],
      TLC: ['Bob'],
      'Anime Info': ['MAL'],
      'http://x': ['y'],
      'Role:sub': ['z'],
      QC: ['x'.repeat(91)],
      TS: ['ok', 't.me/spam'],
      '': ['n']
    },
    null,
    {}
  ];
  for (const s of samples) {
    assert.deepEqual(site.text.cleanStaffRecord(s), cleanStaffRecord(s), JSON.stringify(s));
  }
});

test('synopsis greeting-strip is linear on long space runs (ReDoS regression)', { skip: SKIP }, () => {
  // 'الموسم' + 100k spaces + 'x' used to take ~9s (quadratic \s*[^\n]*
  // partition backtracking). Both copies must stay fast AND identical.
  const s = 'الموسم' + ' '.repeat(100000) + 'x';
  const t0 = Date.now();
  const a = site.text.safeSynopsis(s);
  const b = cleanSynopsis(s);
  const elapsed = Date.now() - t0;
  assert.equal(a, b);
  assert.ok(elapsed < 2000, `greeting-strip took ${elapsed}ms — quadratic regression?`);
});
