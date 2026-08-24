import { BASE, jar, postForm } from './http.mjs';
import { loadEnv } from './util.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36';

export async function ensureSession({ force = false } = {}) {
  loadEnv();
  jar.load();
  if (!force && jar.has('wordpress_logged_in')) return true;

  const user = process.env.RHYTHM_USER;
  const pass = process.env.RHYTHM_PASS;
  if (!user || !pass) throw new Error('RHYTHM_USER / RHYTHM_PASS missing in scraper/.env');

  await fetch(`${BASE}/wp-login.php`, { headers: { 'User-Agent': UA } }).then((r) => r.text());

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
