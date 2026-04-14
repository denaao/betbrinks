const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const previewPath = path.join(__dirname, 'preview.html');
let previewHtml = '';
try { previewHtml = fs.readFileSync(previewPath, 'utf-8'); } catch (e) { previewHtml = '<h1>preview.html not found</h1>'; }

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Serve static files (images, css, js, etc.)
  const ext = path.extname(req.url).toLowerCase();
  if (ext && MIME_TYPES[ext]) {
    const filePath = path.join(__dirname, req.url);
    // Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] });
      res.end(data);
    });
    return;
  }

  // Default: serve preview.html
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(previewHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile preview running on port ${PORT}`);
});
