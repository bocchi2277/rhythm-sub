import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isAllowedImageHost,
  safeRel,
  safeJoin,
  slugFromUrl,
  writeFileAtomic,
  writeJsonAtomic,
  readBodyLimited
} from '../src/util.mjs';

test('isAllowedImageHost parses hostname, not substrings', () => {
  assert.equal(isAllowedImageHost('https://rhythm-sub.com/wp-content/a.jpg'), true);
  assert.equal(isAllowedImageHost('https://i0.wp.com/rhythm-sub.com/a.jpg'), true);
  assert.equal(isAllowedImageHost('https://i2.wp.com/other/a.jpg'), true);
  // Substring spoofing must be rejected.
  assert.equal(isAllowedImageHost('https://evil.example/?rhythm-sub.com/a.jpg'), false);
  assert.equal(isAllowedImageHost('https://rhythm-sub.com.evil.example/a.jpg'), false);
  assert.equal(isAllowedImageHost('https://evilwp.com/a.jpg'), false);
  assert.equal(isAllowedImageHost('not a url'), false);
  assert.equal(isAllowedImageHost(undefined), false);
});

test('safeRel strips dot segments and separators after decoding', () => {
  assert.equal(safeRel(new URL('https://x.com/a/b.jpg')), 'a/b.jpg');
  assert.equal(safeRel(new URL('https://x.com/%2e%2e%2fsecret/a.jpg')), 'secret/a.jpg');
  assert.equal(safeRel(new URL('https://x.com/a%5cb.jpg')), 'a_b.jpg');
  // Literal dot segments are normalized by the URL parser itself...
  assert.equal(safeRel(new URL('https://x.com/./a/../b.jpg')), 'b.jpg');
  // ...and so are pure %2e%2e segments, but an encoded SLASH (%2f) survives
  // parsing and must be stripped after decoding.
  assert.equal(safeRel(new URL('https://x.com/a/%2e%2e%2fb.jpg')), 'a/b.jpg');
  assert.equal(safeRel(new URL('https://x.com/')), '');
});

test('safeJoin refuses paths escaping the base dir', () => {
  const base = path.resolve(os.tmpdir(), 'img-base-test');
  assert.equal(safeJoin(base, 'a/b.jpg'), path.join(base, 'a', 'b.jpg'));
  assert.throws(() => safeJoin(base, '../outside.jpg'), /Refusing path outside/);
  assert.throws(() => safeJoin(base, 'a/../../outside.jpg'), /Refusing path outside/);
});

test('writeJsonAtomic round-trips, overwrites and leaves no temp files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-json-'));
  try {
    const file = path.join(dir, 'data.json');
    writeJsonAtomic(file, { a: 1 });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 1 });
    // Overwrite an existing file (rename must replace, not fail).
    writeJsonAtomic(file, { b: [1, 2, 3] });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { b: [1, 2, 3] });
    // Compact mode produces no indentation.
    writeJsonAtomic(file, { c: 1 }, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), '{"c":1}');
    assert.deepEqual(fs.readdirSync(dir), ['data.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFileAtomic creates parent dirs and writes raw content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-raw-'));
  try {
    const file = path.join(dir, 'nested', 'deep', 'out.txt');
    writeFileAtomic(file, 'hello');
    assert.equal(fs.readFileSync(file, 'utf8'), 'hello');
    writeFileAtomic(file, Buffer.from('bytes'));
    assert.equal(fs.readFileSync(file, 'utf8'), 'bytes');
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['out.txt']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readBodyLimited returns small bodies intact', async () => {
  const res = new Response('hello world');
  const buf = await readBodyLimited(res, 1024);
  assert.equal(buf.toString(), 'hello world');
});

test('readBodyLimited rejects bodies over the streamed cap', async () => {
  const res = new Response('x'.repeat(100));
  await assert.rejects(() => readBodyLimited(res, 50), /cap/);
});

test('readBodyLimited rejects an oversized declared content-length before reading', async () => {
  const res = new Response('small', { headers: { 'content-length': '999999' } });
  await assert.rejects(() => readBodyLimited(res, 100), /content-length/);
});

test('readBodyLimited bounds chunked streams without content-length', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
      controller.close();
    }
  });
  const res = new Response(stream);
  await assert.rejects(() => readBodyLimited(res, 100), /cap/);
});

test('slugFromUrl returns the URL segment and never yields traversal/unsafe names', () => {
  assert.equal(slugFromUrl('https://rhythm-sub.com/2024/01/02/my-post/'), 'my-post');
  assert.equal(slugFromUrl('https://rhythm-sub.com/2024/01/02/my-post'), 'my-post');
  // Encoded separators / dot segments must not survive as path components.
  const weird = slugFromUrl('https://rhythm-sub.com/2024/01/02/%2e%2e/');
  assert.match(weird, /^(post-[a-f0-9]{16}|[a-zA-Z0-9._-]+)$/);
  assert.ok(!weird.includes('/') && !weird.includes('\\') && weird !== '..' && weird !== '.');
  // Garbage/empty input gets a deterministic safe fallback, never an empty filename.
  const empty = slugFromUrl('https://rhythm-sub.com/');
  assert.match(empty, /^post-[a-f0-9]{16}$/);
  assert.equal(empty, slugFromUrl('https://rhythm-sub.com/'));
});