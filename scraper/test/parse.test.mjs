import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePost } from '../src/parse.mjs';

// Fixture shaped like the real upstream post structure (HANDOVER §5):
// h1.entry-title, span.alter, Photon cover, time[datetime], bookmark[data-id],
// select.score, ul.spe li metadata, hr-separated entry-content sections and
// .soraddl download rows.
const MODERN_POST = `
<html><head><title>Great Show - 05 – Rhythm-Sub</title></head><body>
<h1 class="entry-title">Great Show - 05 [1080p HEVC]</h1>
<span class="alter">البديل الأول, Alternative Two</span>
<img class="entry-image wp-post-image" src="https://i0.wp.com/rhythm-sub.com/wp-content/uploads/2024/01/cover.jpg">
<time class="entry-date published" datetime="2024-01-05T10:00:00+03:00"></time>
<div class="bookmark" data-id="12345"></div>
<select class="score" data-current-rating="4.5"></select>
<ul class="spe">
  <li><b>التصنيف:</b> <a rel="tag" href="https://rhythm-sub.com/tag/action/">Action</a> <a rel="tag" href="https://rhythm-sub.com/tag/comedy/">Comedy</a></li>
  <li><b>الحالة:</b> Ongoing</li>
  <li><b>استوديو:</b> <a href="https://rhythm-sub.com/studio/mappa/">MAPPA</a></li>
  <li><b>سنة الإصدار:</b> 2024</li>
  <li><b>الموسم:</b> <a href="https://rhythm-sub.com/season/winter-2024/">Winter 2024</a></li>
  <li><b>النوع:</b> <a href="https://rhythm-sub.com/category/tv/">TV</a></li>
  <li><b>الحلقات:</b> 12</li>
</ul>
<div class="entry-content">
  <div class="mctnx">
    <p>دليل سلسلة الأنمي:</p>
    <p><a href="https://rhythm-sub.com/2023/01/01/great-show-01/">Great Show - 01</a></p>
    <hr>
    <p>قصة الأنمي:</p>
    <p>تدور أحداث القصة في عالم سحري غامض حيث يسعى البطل لتحقيق حلمه الكبير.</p>
    <hr>
    <p>العاملون على المشروع:</p>
    <p>TL: Alice<br>TLC: Bob<br>Anime Info: <a href="https://myanimelist.net/anime/12345/Great_Show">MAL</a></p>
    <hr>
    <div class="soraddl">
      <div class="sorattl"><h3>[Group] Great Show - 05 [1080p HEVC]</h3></div>
      <div class="soraurl"><a class="res" href="#">[1080p HEVC]</a> <a href="https://mega.nz/file/abc#key">MEGA</a> <a href="https://nyaa.si/download/123.torrent">Torrent</a></div>
    </div>
  </div>
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
  <img src="https://i1.wp.com/rhythm-sub.com/wp-content/uploads/2024/01/shot1.jpg">
</div>
</body></html>`;

const URL = 'https://rhythm-sub.com/2024/01/05/great-show-05/';

test('parsePost extracts identity, metadata and rating from a modern post', () => {
  const p = parsePost(MODERN_POST, URL);
  assert.equal(p.slug, 'great-show-05');
  assert.equal(p.title, 'Great Show - 05 [1080p HEVC]');
  assert.deepEqual(p.altTitles, ['البديل الأول', 'Alternative Two']);
  assert.equal(p.postId, '12345');
  assert.equal(p.publishedAt, '2024-01-05T10:00:00+03:00');
  // Photon CDN form must normalize to the origin URL.
  assert.equal(p.cover, 'https://rhythm-sub.com/wp-content/uploads/2024/01/cover.jpg');
  // select.score is /5 — the model stores /10.
  assert.equal(p.rating, 9);
  assert.deepEqual(p.genres, ['Action', 'Comedy']);
  assert.equal(p.status, 'Ongoing');
  assert.equal(p.studio, 'MAPPA');
  assert.equal(p.year, 2024);
  assert.deepEqual(p.season, { text: 'Winter 2024', slug: 'winter-2024' });
  assert.deepEqual(p.type, { text: 'TV', slug: 'tv' });
  assert.equal(p.episodesCount, 12);
  assert.equal(p.trailerYoutubeId, 'dQw4w9WgXcQ');
});

test('parsePost extracts hr-separated sections: guide, synopsis, staff, MAL', () => {
  const p = parsePost(MODERN_POST, URL);
  assert.deepEqual(p.seriesGuide, [
    { title: 'Great Show - 01', url: 'https://rhythm-sub.com/2023/01/01/great-show-01' }
  ]);
  assert.match(p.synopsis, /تدور أحداث القصة/);
  assert.deepEqual(p.staff.TL, ['Alice']);
  assert.deepEqual(p.staff.TLC, ['Bob']);
  // "Anime Info" is a MAL link role, never a staff entry.
  assert.equal(p.staff['Anime Info'], undefined);
  assert.equal(p.malUrl, 'https://myanimelist.net/anime/12345/Great_Show');
});

test('parsePost extracts download rows with quality tags and links', () => {
  const p = parsePost(MODERN_POST, URL);
  assert.equal(p.downloads.length, 1);
  assert.equal(p.downloads[0].label, '[Group] Great Show - 05 [1080p HEVC]');
  const q = p.downloads[0].qualities[0];
  assert.equal(q.quality, '[1080p HEVC]');
  assert.deepEqual(q.links, [
    { name: 'MEGA', url: 'https://mega.nz/file/abc#key' },
    { name: 'Torrent', url: 'https://nyaa.si/download/123.torrent' }
  ]);
  // Content images normalize Photon URLs and dedupe.
  assert.deepEqual(p.contentImages, ['https://rhythm-sub.com/wp-content/uploads/2024/01/shot1.jpg']);
});

// Old posts (2019-2021) have NO hr section headings — the fallback paths must
// still find the synopsis and parse glued staff lines ("TL: X TLC: Y").
const OLD_POST = `
<html><body>
<h1 class="entry-title">Old Show - 03</h1>
<div class="entry-content">
<p>تدور أحداث القصة في مدينة قديمة حيث يعيش بطلنا وحيداً ويبحث عن معنى الحياة.</p>
<p>TL: Alice 123 TLC: Bob<br>QC: Someone<br>TS: GluedTS: Value</p>
<div class="soraddl"><div class="sorattl"><h3>Old Show - 03 [720p]</h3></div>
<div class="soraurl"><a class="res" href="#">[720p]</a> <a href="https://mega.nz/x">MEGA</a></div></div>
</div>
</body></html>`;

test('parsePost old-post fallbacks: synopsis without headings, multi-role staff lines', () => {
  const p = parsePost(OLD_POST, 'https://rhythm-sub.com/2020/05/01/old-show-03/');
  assert.match(p.synopsis, /تدور أحداث القصة/);
  // Verified semantics of the next-role cut: it separates "Alice 123" from
  // "TLC: Bob" because the value contains a non-letter char. A pure-letter
  // glued value ("GluedTS:") is ambiguous — the line is DROPPED, never
  // corrupted into a wrong name.
  assert.deepEqual(p.staff.TL, ['Alice 123']);
  assert.deepEqual(p.staff.QC, ['Someone']);
  assert.equal(p.staff.TS, undefined);
  assert.equal(p.downloads[0].qualities[0].links[0].name, 'MEGA');
});

test('parsePost tolerates an empty/minimal document without crashing', () => {
  const p = parsePost('<html><body></body></html>', 'https://rhythm-sub.com/2024/01/01/x/');
  assert.equal(p.title, '');
  assert.equal(p.rating, null);
  assert.equal(p.publishedAt, null);
  assert.deepEqual(p.downloads, []);
  assert.deepEqual(p.staff, {});
  assert.equal(p.synopsis, '');
});
