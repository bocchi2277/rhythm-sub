/**
 * WordPress REST inventory discovery, authenticated with an Application
 * Password (RHYTHM_APP_PASSWORD — never expires, created by any user from
 * their own profile page, no admin needed).
 *
 * Why this exists: the homepage crawl only sees ~3 recent pages, so episodes
 * published while the pipeline was down (or Cloudflare-challenged) fall out
 * of view permanently. The full REST post list reconciles the inventory on
 * every sync run (2026-11-19: it revealed 14 missing episodes).
 *
 * REST is DISCOVERY ONLY: the theme renders download boxes (.soraddl) and
 * metadata (ul.spe) outside the_content, so content.rendered cannot replace
 * HTML scraping (probed 2026-11-19). Post bodies are still fetched as HTML.
 *
 * fetchImpl is injected so pagination/auth/error paths are unit-testable
 * offline (test/rest-inventory.test.mjs).
 */

export function restAuthHeader(user, appPassword) {
  return 'Basic ' + Buffer.from(`${user}:${appPassword}`).toString('base64');
}

export async function fetchRestInventory({
  user,
  appPassword,
  base = 'https://rhythm-sub.com',
  perPage = 100,
  maxPages = 50,
  fetchImpl = globalThis.fetch,
  sleepMs = 200
} = {}) {
  if (!user || !appPassword) {
    throw new Error('REST inventory requires RHYTHM_USER and RHYTHM_APP_PASSWORD');
  }
  const auth = restAuthHeader(user, appPassword);
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_fields=slug,link,date&orderby=date&order=desc`;
    const res = await fetchImpl(url, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`REST inventory page ${page}: HTTP ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`REST inventory page ${page}: unexpected payload`);
    all.push(...batch);
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    if (page >= totalPages || batch.length === 0) break;
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }
  return all;
}
