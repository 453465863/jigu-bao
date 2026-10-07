import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'out');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2'
};

const resolveFile = (requestPath) => {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const safePath = normalize(decoded)
    .replace(/^([/\\])+/, '')
    .replace(/[/\\]+$/, '');
  const candidates = [join(root, safePath), join(root, safePath, 'index.html'), join(root, `${safePath}.html`)];
  for (const candidate of candidates) {
    if (!candidate.startsWith(root) || !existsSync(candidate)) continue;
    if (statSync(candidate).isFile()) return candidate;
  }
  return join(root, '404.html');
};

createServer((request, response) => {
  const filePath = resolveFile(request.url || '/');
  if (!existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(filePath.endsWith('404.html') ? 404 : 200, {
    'cache-control': 'no-store',
    'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`基估宝预览：http://localhost:${port}/`);
});
