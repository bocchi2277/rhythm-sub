const urls = [
  'https://rhythm-sub.com/wp-content/uploads/2026/08/155050l.jpg',
  'https://rhythm-sub.com/wp-content/uploads/2019/12/80546l.jpg',
  'https://i2.wp.com/rhythm-sub.com/wp-content/uploads/2026/08/e7.jpg'
];

for (const u of urls) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const start = Date.now();
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0' }, signal: ctrl.signal });
    const buf = await res.arrayBuffer();
    console.log(`${res.status} ${buf.byteLength}B ${Date.now() - start}ms ${u}`);
  } catch (e) {
    console.log(`FAIL ${Date.now() - start}ms ${u} :: ${e.name}`);
  }
  clearTimeout(t);
}
