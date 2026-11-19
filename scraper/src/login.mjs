import { pathToFileURL } from 'node:url';
import { BASE, UA, jar, postForm, usingInjectedCookie } from './http.mjs';
import { loadEnv } from './util.mjs';

export async function ensureSession({ force = false } = {}) {
  loadEnv();
  jar.load();

  const injected = Boolean(process.env.RHYTHM_COOKIE);
  // An injected cookie is authoritative — there is no login to validate.
  // Otherwise a cached session is reused unless a forced re-login was asked.
  if (jar.has('wordpress_logged_in') && (injected || !force)) return true;

  // A forced login must not be able to "succeed" on a stale auth cookie left in
  // the jar by a previous session: drop it first, so the check below reflects
  // this login's real result. (An injected RHYTHM_COOKIE is re-applied by
  // jar.load() and must survive — that path has no login to validate.)
  if (force && !injected) {
    for (const k of [...jar.map.keys()]) {
      if (k.startsWith('wordpress_logged_in') || k.startsWith('wordpress_sec')) jar.map.delete(k);
    }
  }

  const user = process.env.RHYTHM_USER;
  const pass = process.env.RHYTHM_PASS;
  if (!user || !pass) {
    throw new Error(
      'RHYTHM_USER / RHYTHM_PASS are not set. Add them to scraper/.env (local) or GitHub Actions secrets (CI).'
    );
  }

  // Prime cookies (Cloudflare clearance: cf_clearance, __cf_bm) before POST —
  // fresh CI runners have no saved jar, and posting without them gets challenged.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const pre = await fetch(`${BASE}/wp-login.php`, {
      headers: { 'User-Agent': UA },
      // Manual redirects: the priming response must come from the BASE
      // origin only. Following an off-site redirect and absorbing its
      // Set-Cookie would be a session-fixation primitive (every other
      // fetch path in http.mjs enforces same-site provenance).
      redirect: 'manual',
      signal: ctrl.signal
    });
    jar.absorb(pre);
    await pre.arrayBuffer().catch(() => {});
  } finally {
    clearTimeout(t);
  }

  const res = await postForm(`${BASE}/wp-login.php`, {
    log: user,
    pwd: pass,
    rememberme: 'forever',
    testcookie: '1',
    redirect_to: `${BASE}/`
  });

  jar.save();
  if (!jar.has('wordpress_logged_in')) {
    throw new Error(
      `login failed: the site did not issue a session cookie (HTTP ${res.status}). ` +
        'Check RHYTHM_USER / RHYTHM_PASS.'
    );
  }
  return true;
}

// When auth is delegated to an injected cookie, a redirect to wp-login means
// the cookie is dead — forcing a login would only fail against a blocked
// wp-login.php, so surface a message the operator can actually act on.
// Shared by sync/crawl/scrape so every re-auth path behaves identically.
export async function reauthOrThrow() {
  if (usingInjectedCookie()) {
    throw new Error(
      'RHYTHM_COOKIE was rejected by rhythm-sub.com (expired or invalid). ' +
        'Refresh it: log in with "remember me" checked, copy the Cookie request ' +
        'header, then update the RHYTHM_COOKIE GitHub secret.'
    );
  }
  await ensureSession({ force: true });
}

// CLI direct run. Compare the resolved path (not a filename suffix): a
// "endsWith('login.mjs')" check would also fire for an unrelated file that
// happens to share the name.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureSession({ force: true })
    .then(() => console.log('LOGIN OK'))
    .catch((e) => {
      console.error('LOGIN FAILED:', e.message);
      process.exit(1);
    });
}
