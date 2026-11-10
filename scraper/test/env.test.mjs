import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvFile } from '../src/util.mjs';

test('parseEnvFile reads plain assignments', () => {
  const parsed = parseEnvFile('RHYTHM_USER=admin\nRHYTHM_PASS=s3cret\n');
  assert.deepEqual(parsed, { RHYTHM_USER: 'admin', RHYTHM_PASS: 's3cret' });
});

test('parseEnvFile ignores comments and blank lines', () => {
  const parsed = parseEnvFile('# a comment\n\nRHYTHM_USER=admin\n   \n# another\n');
  assert.deepEqual(parsed, { RHYTHM_USER: 'admin' });
});

test('parseEnvFile accepts an export prefix', () => {
  assert.deepEqual(parseEnvFile('export RHYTHM_USER=admin\n'), { RHYTHM_USER: 'admin' });
});

test('parseEnvFile accepts digits in names and trims whitespace', () => {
  assert.deepEqual(parseEnvFile('KEY2=value\n  RHYTHM_USER  =  admin  \n'), {
    KEY2: 'value',
    RHYTHM_USER: 'admin'
  });
});

test('parseEnvFile strips matching quotes', () => {
  assert.deepEqual(parseEnvFile('A="hello world"\nB=\'single\'\n'), {
    A: 'hello world',
    B: 'single'
  });
});

test('parseEnvFile keeps a hash inside a quoted value', () => {
  assert.deepEqual(parseEnvFile('A="a # b"\n'), { A: 'a # b' });
});

test('parseEnvFile strips an inline comment outside quotes', () => {
  assert.deepEqual(parseEnvFile('A=value # trailing\n'), { A: 'value' });
});

test('parseEnvFile skips malformed lines', () => {
  assert.deepEqual(parseEnvFile('not a pair\n1BAD=x\nOK=1\n'), { OK: '1' });
});
