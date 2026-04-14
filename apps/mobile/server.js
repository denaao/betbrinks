const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 8080;

const previewPath = path.join(__dirname, 'preview.html');
let previewHtml = '';
try { previewHtml = fs.readFileSync(previewPath, 'utf-8'); } catch (e) { previewHtml = '<h1>preview.html not found</h1>'; }

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(previewHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile preview running on port ${PORT}`);
});
