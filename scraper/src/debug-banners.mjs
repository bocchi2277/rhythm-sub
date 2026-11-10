import fs from 'node:fs';
import * as cheerio from 'cheerio';

const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error('Usage: node src/debug-banners.mjs <path-to-html-file>');
  process.exit(1);
}
const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

$('a[href] img').each((_, img) => {
  const src = $(img).attr('src') ?? '';
  if (/\/img\//i.test(src)) {
    console.log(JSON.stringify({ src, href: $(img).closest('a').attr('href'), alt: $(img).attr('alt') }));
  }
});

// also any img with /img/ not inside a link
$('img').each((_, img) => {
  const src = $(img).attr('src') ?? '';
  if (/\/img\//i.test(src) && !$(img).closest('a').length) {
    console.log('NO-LINK:', src);
  }
});
