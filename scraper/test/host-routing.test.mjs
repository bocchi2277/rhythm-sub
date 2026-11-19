import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostIs, urlPathEndsWith } from '../src/util.mjs';

/**
 * CodeQL js/incomplete-url-substring-sanitization (4 high alerts on the first
 * scan): downloader routing used url.includes('drive.google.com') etc., which
 * also matches https://evil.com/?x=drive.google.com. hostIs/urlPathEndsWith
 * parse the URL instead. These tests pin the bypass shapes.
 */

test('hostIs matches the exact host and its subdomains', () => {
  assert.equal(hostIs('https://drive.google.com/file/d/123', 'drive.google.com'), true);
  assert.equal(hostIs('https://www.mediafire.com/file/abc', 'mediafire.com'), true);
  assert.equal(hostIs('https://mediafire.com/file/abc', 'mediafire.com'), true);
  assert.equal(hostIs('https://mega.nz/file/abc#key', 'mega.nz'), true);
  assert.equal(hostIs('https://nyaa.si/download/1.torrent', 'nyaa.si'), true);
});

test('hostIs rejects substring lookalikes in query, path and host suffix', () => {
  // The exact bypass CodeQL flagged: the domain appears, but not as the host.
  assert.equal(hostIs('https://evil.com/?x=drive.google.com', 'drive.google.com'), false);
  assert.equal(hostIs('https://evil.com/drive.google.com/file', 'drive.google.com'), false);
  assert.equal(hostIs('https://drive.google.com.evil.com/file', 'drive.google.com'), false);
  assert.equal(hostIs('https://notmediafire.com/file', 'mediafire.com'), false);
  assert.equal(hostIs('https://mediafire.com.evil.io/x', 'mediafire.com'), false);
  assert.equal(hostIs('https://evil.com/?nyaa.si', 'nyaa.si'), false);
});

test('hostIs is case-insensitive and safe on non-URL input', () => {
  assert.equal(hostIs('https://DRIVE.GOOGLE.COM/x', 'drive.google.com'), true);
  assert.equal(hostIs('magnet:?xt=urn:btih:abc', 'nyaa.si'), false);
  assert.equal(hostIs('/local/path/file.mkv', 'mega.nz'), false);
  assert.equal(hostIs('', 'mega.nz'), false);
  assert.equal(hostIs('not a url at all', 'mega.nz'), false);
});

test('urlPathEndsWith checks the path only, not query or fragment', () => {
  assert.equal(urlPathEndsWith('https://nyaa.si/download/123.torrent', '.torrent'), true);
  assert.equal(urlPathEndsWith('https://cdn.example.com/f/FILE.TORRENT?x=1', '.torrent'), true);
  // A query mentioning .torrent must not route a plain HTML page to aria2c.
  assert.equal(urlPathEndsWith('https://evil.com/page?file=x.torrent', '.torrent'), false);
  assert.equal(urlPathEndsWith('https://evil.com/.torrent.html', '.torrent'), false);
  assert.equal(urlPathEndsWith('magnet:?xt=urn:btih:abc', '.torrent'), false);
});
