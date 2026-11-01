// Lightweight local storefront preview for environments where the database
// connection is unavailable. The API remains served by backend/server.js.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 5001);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const handleRequest = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ message: 'The API is unavailable until the MongoDB connection is restored.' }));
    return;
  }

  let filename = path.resolve(root, `.${pathname}`);
  if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');

  fs.readFile(filename, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(filename).toLowerCase() === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
};

for (const host of ['127.0.0.1', '::1']) {
  http.createServer(handleRequest).listen(port, host, () => {
    console.log(`Storefront preview listening at http://${host}:${port}`);
  });
}
