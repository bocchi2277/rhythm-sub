import { BASE, UA, jar, postForm } from './http.mjs';
import { loadEnv } from './util.mjs';

export async function ensureSession({ force = false } = {}) {
  loadEnv();
  jar.load();
  if (!force && jar.has('wordpress_logged_in')) return true;

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
    throw new Error(`login failed (HTTP ${res.status}) - check credentials`);
  }
  return true;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  ensureSession({ force: true })
    .then(() => console.log('LOGIN OK'))
    .catch((e) => {
      console.error('LOGIN FAILED:', e.message);
      process.exit(1);
    });
}
