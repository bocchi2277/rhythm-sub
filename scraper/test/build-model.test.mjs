import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSlug,
  asciiSlug,
  episodeNumberFrom,
  extractEpisodeMetadata,
  groupPosts
} from '../src/build-model.mjs';

test('normalizeSlug strips episode/number suffixes', () => {
  assert.equal(normalizeSlug('anime-name-episode-12'), 'anime-name');
  assert.equal(normalizeSlug('anime-name-ep-3'), 'anime-name');
  assert.equal(normalizeSlug('anime-name-12'), 'anime-name');
  assert.equal(normalizeSlug('anime-name-01-12'), 'anime-name');
  assert.equal(normalizeSlug('anime-name'), 'anime-name');
});

test('asciiSlug decodes, transliterates and falls back', () => {
  assert.equal(asciiSlug('Caf%C3%A9%20Anime'), 'cafe-anime');
  assert.equal(asciiSlug('Über!!Anime'), 'uber-anime');
  assert.equal(asciiSlug('!!!'), 'anime');
  assert.equal(asciiSlug('  Multiple---Spaces  '), 'multiple-spaces');
});

test('episodeNumberFrom reads slug and title numbers', () => {
  assert.equal(episodeNumberFrom({ slug: 'show-episode-7', title: 'Show' }), 7);
  assert.equal(episodeNumberFrom({ slug: 'show-ep-12', title: 'Show' }), 12);
  assert.equal(episodeNumberFrom({ slug: 'show-5', title: 'Show' }), 5);
  // BD batch suffix must not be treated as an episode number.
  assert.equal(episodeNumberFrom({ slug: 'show-bd-12', title: 'Show BD' }), null);
  assert.equal(episodeNumberFrom({ slug: 'show', title: 'Show - 9 END' }), 9);
  // Movies do not get a number from the title.
  assert.equal(episodeNumberFrom({ slug: 'show', title: 'Show - 9', type: { text: 'Movie' } }), null);
});

test('extractEpisodeMetadata handles ranges, volumes, BD and movies', () => {
  assert.deepEqual(extractEpisodeMetadata({ slug: 'x', title: 'X - 01 ~ 05' }), {
    displayNum: '01~05', number: 5, label: 'X - 01 ~ 05'
  });
  assert.equal(extractEpisodeMetadata({ slug: 'x', title: 'X - 01 ~ 05 END' }).displayNum, '01~05 END');
  assert.equal(extractEpisodeMetadata({ slug: 'x', title: 'X Vol.02' }).number, 200);
  assert.equal(extractEpisodeMetadata({ slug: 'x', title: 'X', type: { text: 'BD' } }).displayNum, 'BD');
  assert.equal(extractEpisodeMetadata({ slug: 'x', title: 'X', type: { text: 'Movie' } }).displayNum, 'فيلم');
  assert.equal(extractEpisodeMetadata({ slug: 'x-3', title: 'X - 3' }).number, 3);
  assert.equal(extractEpisodeMetadata({ slug: 'x', title: 'X' }).number, null);
});

test('groupPosts merges slug group into MAL group when MAL arrives first', () => {
  // Regression: a MAL post arriving BEFORE its non-MAL sibling used to leave a
  // duplicate slug-only series behind (one-directional merge).
  const malFirst = { slug: 'great-show-1', malUrl: 'https://myanimelist.net/anime/111/Great_Show', title: 'Great Show - 1' };
  const plainLater = { slug: 'great-show-2', malUrl: null, title: 'Great Show - 2' };
  const groups = groupPosts([malFirst, plainLater]);
  assert.equal(groups.size, 1);
  assert.ok(groups.has('mal:111'));
  assert.equal(groups.get('mal:111').length, 2);
});

test('groupPosts merges when non-MAL arrives first too', () => {
  const plainFirst = { slug: 'great-show-2', malUrl: null, title: 'Great Show - 2' };
  const malLater = { slug: 'great-show-1', malUrl: 'https://myanimelist.net/anime/111/Great_Show', title: 'Great Show - 1' };
  const groups = groupPosts([plainFirst, malLater]);
  assert.equal(groups.size, 1);
  assert.ok(groups.has('mal:111'));
  assert.equal(groups.get('mal:111').length, 2);
});

test('groupPosts keeps distinct MAL ids and slug-only series separate', () => {
  const a = { slug: 'alpha-1', malUrl: 'https://myanimelist.net/anime/1/Alpha', title: 'Alpha - 1' };
  const b = { slug: 'beta-1', malUrl: 'https://myanimelist.net/anime/2/Beta', title: 'Beta - 1' };
  const c = { slug: 'gamma-1', malUrl: null, title: 'Gamma - 1' };
  const d = { slug: 'gamma-2', malUrl: null, title: 'Gamma - 2' };
  const groups = groupPosts([a, b, c, d]);
  assert.equal(groups.size, 3);
  assert.equal(groups.get('mal:1').length, 1);
  assert.equal(groups.get('mal:2').length, 1);
  assert.equal(groups.get('slug:gamma').length, 2);
});

test('groupPosts is deterministic regardless of input order', () => {
  const posts = [
    { slug: 'show-x-1', malUrl: 'https://myanimelist.net/anime/5/Show_X', title: 'Show X - 1' },
    { slug: 'show-x-2', malUrl: null, title: 'Show X - 2' },
    { slug: 'show-x-3', malUrl: null, title: 'Show X - 3' }
  ];
  const forward = groupPosts(posts);
  const backward = groupPosts([...posts].reverse());
  assert.deepEqual([...forward.keys()], [...backward.keys()]);
  assert.equal(forward.get('mal:5').length, 3);
  assert.equal(backward.get('mal:5').length, 3);
});