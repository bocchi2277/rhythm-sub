import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerHooks } from 'node:module';

/**
 * Unit tests for the site data pipeline's pure/injectable modules
 * (series-split, team-releases) plus a smoke test of the composition root.
 *
 * Node's type stripping executes .ts but does NOT resolve extensionless
 * relative imports (the site uses bundler resolution). registerHooks adds the
 * .ts extension at resolve time so these modules load here without a bundler.
 * Requires Node >= 22.15; on older runtimes the suite skips (same convention
 * as the sanitizer/parity tests).
 */
let site = null;
try {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          // fall through to default resolution
        }
      }
      return nextResolve(specifier, context);
    }
  });
  site = {
    split: await import('../../site/lib/series-split.ts'),
    team: await import('../../site/lib/team-releases.ts'),
    episodes: await import('../../site/lib/episodes.ts'),
    data: await import('../../site/lib/data.ts')
  };
} catch {
  site = null;
}

const SKIP = site ? false : 'Node registerHooks/type stripping unavailable — site pipeline not checked';

const ep = (label, over = {}) => ({
  slug: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  label,
  number: null,
  displayNum: null,
  date: null,
  rating: null,
  cover: null,
  synopsis: '',
  trailerYoutubeId: null,
  qualities: [],
  contentImages: [],
  postId: null,
  author: null,
  url: '',
  ...over
});

const series = (over = {}) => ({
  key: 'slug:great-show',
  malUrl: null,
  slug: 'great-show',
  title: 'Great Show',
  altTitles: null,
  cover: null,
  genres: [],
  status: 'Ongoing',
  studio: null,
  year: null,
  season: null,
  type: { text: 'TV', slug: 'tv' },
  episodesCount: null,
  rating: null,
  synopsis: '',
  trailerYoutubeId: null,
  staff: {},
  relatedSeries: [],
  lastReleaseAt: null,
  episodes: [],
  ...over
});

// ── splitForeignWorks ──────────────────────────────────────────────────────

test('splitForeignWorks exiles a titled minority into a synthetic series', { skip: SKIP }, () => {
  const host = series({
    episodes: [
      ...Array.from({ length: 6 }, (_, i) => ep(`Great Show - 0${i + 1}`)),
      ep('Other Work - 01'),
      ep('Other Work - 02')
    ]
  });
  const out = site.split.splitForeignWorks([host]);
  assert.equal(out.length, 2);
  assert.equal(out[0].episodes.length, 6);
  assert.equal(out[0].title, 'Great Show');
  const synth = out[1];
  assert.equal(synth.slug, 'other-work');
  assert.equal(synth.key, 'slug:great-show:x:other-work');
  assert.equal(synth.episodes.length, 2);
});

test('splitForeignWorks never exiles a lone post or touches small series', { skip: SKIP }, () => {
  const lone = series({
    episodes: [...Array.from({ length: 6 }, (_, i) => ep(`Great Show - 0${i + 1}`)), ep('Other Work - 01')]
  });
  assert.equal(site.split.splitForeignWorks([lone]).length, 1);
  assert.equal(lone.episodes.length, 7);

  const small = series({ episodes: [ep('Great Show - 01'), ep('Other Work - 01')] });
  assert.equal(site.split.splitForeignWorks([small]).length, 1);
  assert.equal(small.episodes.length, 2);
});

// ── applyTeamReleases / normalizeTeamQualities / readTeamReleases ─────────

const release = (over = {}) => ({
  file: 'r.json',
  value: {
    seriesSlug: 'great-show',
    seriesTitle: 'Great Show',
    episodeNumber: 8,
    label: 'Great Show - 08 [1080p]',
    date: '2024-02-01',
    qualities: [{ quality: '[1080p]', links: [{ name: 'MEGA', url: 'https://mega.nz/x' }] }],
    ...over
  }
});
const byDate = (a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''));

test('applyTeamReleases merges a manual release into the matching series', { skip: SKIP }, () => {
  const all = [series()];
  site.team.applyTeamReleases(all, [release()], byDate);
  assert.equal(all.length, 1);
  assert.equal(all[0].episodes.length, 1);
  const e = all[0].episodes[0];
  assert.equal(e.slug, 'great-show-8');
  assert.equal(e.number, 8);
  assert.equal(e.date, '2024-02-01T00:00:00+03:00');
  // cleanTags strips the fully-wrapping bracket pair.
  assert.equal(e.qualities[0].quality, '1080p');
});

test('applyTeamReleases creates a synthetic team series for unknown slugs', { skip: SKIP }, () => {
  const all = [series()];
  site.team.applyTeamReleases(all, [release({ seriesSlug: 'new-show', seriesTitle: 'New Show' })], byDate);
  assert.equal(all.length, 2);
  assert.equal(all[1].key, 'team:new-show');
  assert.equal(all[1].episodes.length, 1);
});

test('applyTeamReleases fails loudly on malformed hand-authored input', { skip: SKIP }, () => {
  const run = (r) => site.team.applyTeamReleases([series()], [r], byDate);
  assert.throws(() => run(release({ label: '' })), /label is required/);
  assert.throws(() => run(release({ seriesSlug: 'Bad Slug!' })), /seriesSlug must be/);
  assert.throws(() => run(release({ episodeNumber: 'abc' })), /episodeNumber must be numeric/);
  assert.throws(() => run(release({ date: 'not-a-date' })), /date is not parseable/);
  assert.throws(
    () => run(release({ qualities: [{ quality: '[1080p]', links: [{ name: 'X', url: 'javascript:alert(1)' }] }] })),
    /needs a name and a safe URL/
  );
  assert.throws(() => run(release({ qualities: 'nope' })), /qualities must be an array/);
});

test('applyTeamReleases skips Arabic-only titles without a slug instead of colliding', { skip: SKIP }, () => {
  const all = [series()];
  site.team.applyTeamReleases(all, [release({ seriesSlug: '', seriesTitle: 'أنمي عربي فقط' })], byDate);
  assert.equal(all.length, 1);
  assert.equal(all[0].episodes.length, 0);
});

test('readTeamReleases skips _prefixed files and names the invalid one', { skip: SKIP }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'releases-test-'));
  try {
    const relDir = path.join(dir, 'releases');
    fs.mkdirSync(relDir);
    fs.writeFileSync(path.join(relDir, '_example.json'), '{}');
    fs.writeFileSync(path.join(relDir, 'a.json'), '{"label":"x"}');
    const ok = site.team.readTeamReleases(dir);
    assert.deepEqual(ok.map((r) => r.file), ['a.json']);
    fs.writeFileSync(path.join(relDir, 'bad.json'), '{');
    assert.throws(() => site.team.readTeamReleases(dir), /Invalid data\/releases\/bad\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Composition-root smoke test (real data, build-time pipeline) ──────────

test('data.ts pipeline loads real data and keeps its invariants', { skip: SKIP }, () => {
  const d = site.data;
  assert.ok(d.allSeries.length > 400, `expected the full catalog, got ${d.allSeries.length}`);
  // bySlug/byKey are O(1) lookups consistent with the collection.
  assert.equal(d.bySlug(d.allSeries[0].slug), d.allSeries[0]);
  assert.equal(d.byKey(d.allSeries[0].key), d.allSeries[0]);
  // Every episode survived validation with the fields the UI dereferences.
  for (const s of d.allSeries) {
    for (const e of s.episodes) {
      assert.equal(typeof e.slug, 'string');
      assert.equal(typeof e.label, 'string');
      assert.ok(Array.isArray(e.qualities));
    }
  }
  // latestReleases: dated entries first, descending.
  const dated = d.latestReleases.filter((r) => r.ep.date);
  for (let i = 1; i < dated.length; i++) {
    assert.ok(String(dated[i - 1].ep.date) >= String(dated[i].ep.date));
  }
  assert.ok(Array.isArray(d.franchises));
});
