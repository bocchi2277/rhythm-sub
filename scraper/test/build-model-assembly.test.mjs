import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleSeries, buildReport } from '../src/build-model.mjs';

/**
 * The series-assembly pipeline extracted from main() — pure posts-in /
 * series-out, no fs. Expected values are derived by hand from the documented
 * rules (title trimming, slug collision suffixes, MAL grouping, episode
 * ordering, staff merge, guide-based relatedSeries with the shared-word
 * filter, franchise cover dedupe, final date sort).
 */

const post = (over = {}) => ({
  slug: 'show-episode-1',
  title: 'Show - 1',
  publishedAt: '2024-01-01T00:00:00+03:00',
  cover: 'https://rhythm-sub.com/wp-content/uploads/cover.jpg',
  contentImages: [],
  downloads: [{ qualities: [{ quality: '[1080p]', links: [{ name: 'MEGA', url: 'https://mega.nz/file/x#y' }] }] }],
  staff: {},
  ...over
});

test('assembleSeries builds one series with trimmed title, parsed episode number and flattened qualities', () => {
  const list = assembleSeries([
    post({ slug: 'senki-episode-5', title: 'Youjo Senki - 5', publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/12345' })
  ]);
  assert.equal(list.length, 1);
  const s = list[0];
  assert.equal(s.title, 'Youjo Senki');
  assert.equal(s.slug, 'senki'); // normalizeSlug strips the episode suffix — series-level slug
  assert.equal(s.key, 'mal:https://myanimelist.net/anime/12345');
  assert.equal(s.lastReleaseAt, '2024-02-01T00:00:00+03:00');
  assert.equal(s.episodes.length, 1);
  assert.equal(s.episodes[0].number, 5);
  assert.equal(s.episodes[0].displayNum, '5');
  assert.equal(s.episodes[0].label, 'Youjo Senki - 5');
  assert.equal(s.episodes[0].date, '2024-02-01T00:00:00+03:00');
  assert.deepEqual(s.episodes[0].qualities, [{ quality: '[1080p]', links: [{ name: 'MEGA', url: 'https://mega.nz/file/x#y' }] }]);
  assert.deepEqual(s.relatedSeries, []);
  assert.equal('seriesGuideUrls' in s, false, 'guide URLs are an internal field, deleted before output');
});

test('assembleSeries orders episodes newest-first and merges staff without duplicates', () => {
  const list = assembleSeries([
    post({ slug: 'merge-episode-1', title: 'Merge - 1', publishedAt: '2024-01-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/7', staff: { TL: ['Alice'] } }),
    post({ slug: 'merge-episode-5', title: 'Merge - 5', publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/7', staff: { TL: ['Alice', 'Bob'], QC: ['Cara'] } })
  ]);
  assert.equal(list.length, 1);
  const s = list[0];
  assert.deepEqual(s.episodes.map((e) => e.number), [5, 1]);
  assert.deepEqual(s.staff, { TL: ['Alice', 'Bob'], QC: ['Cara'] });
  assert.equal(s.lastReleaseAt, '2024-02-01T00:00:00+03:00');
});

test('assembleSeries suffixes colliding slugs with -2 (or -year when available)', () => {
  const a = post({ slug: 'dup-episode-1', title: 'Dup Alpha - 1', publishedAt: '2024-01-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/1' });
  const b = post({ slug: 'dup-episode-1', title: 'Dup Beta - 1', publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/2' });
  // Passed out of order on purpose: assembleSeries must sort deterministically.
  const list = assembleSeries([b, a]);
  const byKey = new Map(list.map((s) => [s.key, s]));
  assert.equal(byKey.get('mal:https://myanimelist.net/anime/1').slug, 'dup');
  assert.equal(byKey.get('mal:https://myanimelist.net/anime/2').slug, 'dup-2');

  // The year suffix applies only when the NEWEST member of the colliding
  // group carries a year — give the 2024 copy a newer date so it is newest.
  const withYear = assembleSeries([b, { ...a, year: null }, { ...b, year: 2024, publishedAt: '2024-03-01T00:00:00+03:00' }]);
  const byKey2 = new Map(withYear.map((s) => [s.key, s]));
  assert.equal(byKey2.get('mal:https://myanimelist.net/anime/2').slug, 'dup-2024');
});

test('assembleSeries: a MAL post absorbs the slug-only group of the same slug', () => {
  const list = assembleSeries([
    post({ slug: 'abs-episode-1', title: 'Abs - 1', publishedAt: '2024-01-01T00:00:00+03:00' }),
    post({ slug: 'abs-episode-1', title: 'Abs - 1', publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/9' })
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].key, 'mal:https://myanimelist.net/anime/9');
  assert.equal(list[0].episodes.length, 1, 'same-slug duplicates collapse to one episode');
});

test('assembleSeries recognizes BD batches and episode ranges', () => {
  const list = assembleSeries([
    post({ slug: 'range-bd', title: 'Range - BD', type: { text: 'BD' }, malUrl: 'https://myanimelist.net/anime/20' }),
    post({ slug: 'range-episode-1', title: 'Range - 01 ~ 05 END', publishedAt: '2024-03-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/20' })
  ]);
  const eps = list[0].episodes;
  const bd = eps.find((e) => e.displayNum === 'BD');
  const range = eps.find((e) => e.label === 'Range - 01 ~ 05 END');
  assert.equal(bd.number, 9999);
  assert.equal(range.number, 5);
  assert.equal(range.displayNum, '01~05 END');
});

test('assembleSeries links relatedSeries via guides only when titles share a meaningful word', () => {
  const list = assembleSeries([
    post({
      slug: 'senki-episode-1', title: 'Youjo Senki - 1', malUrl: 'https://myanimelist.net/anime/30',
      seriesGuide: [
        { url: 'https://rhythm-sub.com/2024/01/02/senki-2-episode-1/' },
        { url: 'https://rhythm-sub.com/2024/01/02/other-episode-1/' }
      ]
    }),
    post({ slug: 'senki-2-episode-1', title: 'Youjo Senki 2 - 1', publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/31' }),
    post({ slug: 'other-episode-1', title: 'Completely Different - 1', publishedAt: '2024-02-02T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/32' })
  ]);
  const a = list.find((s) => s.key === 'mal:https://myanimelist.net/anime/30');
  assert.ok(a.relatedSeries.includes('mal:https://myanimelist.net/anime/31'), 'shared-word guide target is related');
  assert.ok(!a.relatedSeries.includes('mal:https://myanimelist.net/anime/32'), 'no shared meaningful word → not related');
});

test('assembleSeries resolves duplicate franchise covers to an unused content image', () => {
  const shared = 'https://rhythm-sub.com/wp-content/uploads/shared.jpg';
  const alt = 'https://rhythm-sub.com/wp-content/uploads/alt.jpg';
  const list = assembleSeries([
    post({ slug: 'cov-a-episode-1', title: 'Cov Alpha - 1', cover: shared, malUrl: 'https://myanimelist.net/anime/40' }),
    post({ slug: 'cov-b-episode-1', title: 'Cov Beta - 1', cover: shared, contentImages: [alt], publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/41' })
  ]);
  const byKey = new Map(list.map((s) => [s.key, s]));
  assert.equal(byKey.get('mal:https://myanimelist.net/anime/40').cover, shared);
  assert.equal(byKey.get('mal:https://myanimelist.net/anime/41').cover, alt);
});

test('assembleSeries returns series sorted by lastReleaseAt descending', () => {
  const list = assembleSeries([
    post({ slug: 'old-episode-1', title: 'Old - 1', publishedAt: '2024-01-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/50' }),
    post({ slug: 'new-episode-1', title: 'New - 1', publishedAt: '2024-06-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/51' })
  ]);
  assert.equal(list[0].key, 'mal:https://myanimelist.net/anime/51');
  assert.equal(list[1].key, 'mal:https://myanimelist.net/anime/50');
});

test('buildReport renders totals with the injected timestamp and counts images independently', () => {
  const shared = 'https://rhythm-sub.com/wp-content/uploads/shared.jpg';
  const alt = 'https://rhythm-sub.com/wp-content/uploads/alt.jpg';
  const list = assembleSeries([
    post({ slug: 'rep-a-episode-1', title: 'Rep Alpha - 1', cover: shared, malUrl: 'https://myanimelist.net/anime/60' }),
    post({ slug: 'rep-b-episode-1', title: 'Rep Beta - 1', cover: shared, contentImages: [alt], publishedAt: '2024-02-01T00:00:00+03:00', malUrl: 'https://myanimelist.net/anime/61' })
  ]);
  const { markdown, totalEpisodes, uniqueImages } = buildReport(list, 2, 2, '2026-01-01T00:00:00.000Z');
  assert.equal(totalEpisodes, 2);
  // Covers after dedupe: shared (A) + alt (B); alt also appears in contentImages.
  assert.equal(uniqueImages, 2);
  assert.ok(markdown.includes('Generated: 2026-01-01T00:00:00.000Z'));
  assert.ok(markdown.includes('Source posts loaded: **2 / 2**'));
  assert.ok(markdown.includes('Series entities: **2**'));
  assert.ok(markdown.includes('Episode/release entries: **2**'));
});
