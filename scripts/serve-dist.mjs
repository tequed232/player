/**
 * Serve ./dist with a plain static file server (no Vite) to prove the production
 * build is deployable anywhere.
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.argv[2] ?? 4174);
const root = path.resolve('dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  let filePath = path.join(root, decodeURIComponent(url.pathname));
  try {
    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) filePath = path.join(root, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`404 ${error instanceof Error ? error.message : ''}`);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`dist served on http://127.0.0.1:${port}/`);
});
