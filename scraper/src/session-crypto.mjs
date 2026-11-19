// Authenticated encryption for the cached WordPress session (GitHub Actions
// cache). AES-256-GCM (AEAD) replaces the previous openssl AES-256-CBC blob,
// which was UNAUTHENTICATED: any run that can write a main-scoped cache entry
// could tamper with the blob undetected (malleability), and GitHub's own docs
// warn that any fork PR can READ cache entries. The key never leaves the
// RHYTHM_SESSION_KEY secret; PBKDF2-HMAC-SHA256 with 600000 iterations keeps
// an offline brute-force against a stolen blob expensive.
//
// Blob format: "RSC1" | salt(16) | iv(12) | authTag(16) | ciphertext.
// Legacy "Salted__" (openssl CBC) blobs are NOT handled here — the workflow
// keeps a read-only openssl fallback for migration and re-seals as GCM.
//
// Pure node:crypto/fs — no scraper dependencies, so it runs before npm ci and
// is unit-testable without network or credentials.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENC_FILE = path.join(ROOT, 'scraper', '.session.enc');
const JSON_FILE = path.join(ROOT, 'scraper', '.session.json');
const MAGIC = Buffer.from('RSC1');
const ITERATIONS = 600000;

function deriveKey(pass, salt) {
  return crypto.pbkdf2Sync(pass, salt, ITERATIONS, 32, 'sha256');
}

/** Encrypt a session buffer into the RSC1 authenticated format. */
export function encryptBuffer(plain, pass) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(pass, salt), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ct]);
}

/** Decrypt an RSC1 blob. Throws on tampering, truncation or a wrong key. */
export function decryptBuffer(blob, pass) {
  if (blob.length < 48 || !blob.subarray(0, 4).equals(MAGIC)) {
    throw new Error('not an RSC1 session blob');
  }
  const salt = blob.subarray(4, 20);
  const iv = blob.subarray(20, 32);
  const tag = blob.subarray(32, 48);
  const ct = blob.subarray(48);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(pass, salt), iv);
  decipher.setAuthTag(tag);
  // final() throws when the auth tag does not verify (tampered ct/tag/key).
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function keyFromEnv() {
  const key = process.env.RHYTHM_SESSION_KEY;
  if (!key) throw new Error('RHYTHM_SESSION_KEY is not set');
  return key;
}

export function encryptFile() {
  fs.writeFileSync(ENC_FILE, encryptBuffer(fs.readFileSync(JSON_FILE), keyFromEnv()));
}

export function decryptFile() {
  fs.writeFileSync(JSON_FILE, decryptBuffer(fs.readFileSync(ENC_FILE), keyFromEnv()));
}

// CLI direct run (resolved-path comparison, same convention as login.mjs).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  try {
    if (mode === 'encrypt') {
      encryptFile();
      console.log('Session encrypted (AES-256-GCM).');
    } else if (mode === 'decrypt') {
      decryptFile();
      console.log('Cached session decrypted (AES-256-GCM).');
    } else {
      console.error('usage: session-crypto.mjs encrypt|decrypt');
      process.exit(2);
    }
  } catch (e) {
    console.error(`session-crypto ${mode} failed: ${e.message}`);
    process.exit(1);
  }
}
