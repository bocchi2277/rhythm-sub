import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('out');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json'
};

http
  .createServer((req, res) => {
    let url;
    let p;
    try {
      url = new URL(req.url, 'http://x');
      p = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      return res.end('bad request');
    }
    const file = path.resolve(ROOT, '.' + (p.endsWith('/') ? p + 'index.html' : p));
    // Contain the request inside ROOT: percent-decoded `%2e%2e%2f` would
    // otherwise read arbitrary files from disk.
    const relToRoot = path.relative(ROOT, file);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    try {
      if (!p.endsWith('/') && fs.statSync(file).isDirectory()) {
        const canonical = '/' + url.pathname.replace(/^\/+/, '') + '/' + url.search;
        res.writeHead(308, { Location: canonical });
        return res.end();
      }
      const data = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  })
  .listen(3111, '127.0.0.1', () => console.log('serving on http://localhost:3111'));
