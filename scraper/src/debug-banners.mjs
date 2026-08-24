import fs from 'node:fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('C:/Users/mohamed/AppData/Local/Temp/opencode/rhythm_home.html', 'utf8');
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
