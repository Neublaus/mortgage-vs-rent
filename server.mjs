import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname);
const primaryPort = Number.parseInt(process.env.PORT ?? '4173', 10);
const host = process.env.HOST ?? '0.0.0.0';
const alsoServeDefaultHttpPort = process.env.DISABLE_PORT_80 !== '1' && primaryPort !== 80;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function safePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = normalize(join(root, requestedPath));
  return filePath.startsWith(root + sep) || filePath === root ? filePath : null;
}

function handleRequest(request, response) {
  const filePath = safePath(request.url ?? '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

function startServer(port, label, required = false) {
  const server = createServer(handleRequest);

  server.on('error', (error) => {
    if (required) {
      console.error(`Unable to start ${label} on ${host}:${port}`);
      throw error;
    }

    console.warn(`Optional ${label} on ${host}:${port} is not available: ${error.code ?? error.message}`);
    console.warn(`Use http://127.0.0.1:${primaryPort}/ instead, or run with PORT=80 if your system allows it.`);
  });

  server.listen(port, host, () => {
    console.log(`${label} is running on http://${host}:${port}`);
  });
}

startServer(primaryPort, 'Image tone automation', true);

if (alsoServeDefaultHttpPort) {
  startServer(80, 'Default 127.0.0.1 site');
}

console.log(`Open this URL: http://127.0.0.1:${primaryPort}/`);
console.log('If you typed only http://127.0.0.1 and it refuses to connect, either keep this server running with port 80 available or include the port shown above.');
console.log('If you are in a cloud IDE, open/forward the preview for the printed port instead of using your computer\'s 127.0.0.1.');
