'use strict';
// Tiny static server for the two SPAs, using ONLY Node's built-in http module
// (no Express dependency to keep the packaged app slim).
//
// It reproduces what the web docker-entrypoint.sh + nginx did in the container:
//   1. Serve the built SPA (index.html + assets) with SPA fallback (any unknown
//      route -> index.html so client-side routing works).
//   2. Inject runtime config at GET /config/env.js -> window.__ENV__ = {...}
//      with the SAME variable names the frontends read (see apps/*/src/lib/env).
//   3. Reverse-proxy /api/* and /uploads/* to the API on 127.0.0.1:4000, exactly
//      like nginx did when BACKEND_URL was set. The SPAs call the API at the
//      RELATIVE path /api/<version> (see apps/pmt-web/src/lib/api.ts baseURL),
//      so this proxy is what actually reaches the backend.
//
// Both servers bind 0.0.0.0 so other machines on the LAN can open them.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_HOST = '127.0.0.1';
const API_PORT = 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Build the /config/env.js body that sets window.__ENV__.
 * Mirrors the object written by the web docker-entrypoint.sh, but for AUTH_MODE=jwt
 * (self-contained login) so no Keycloak vars are needed.
 *
 * @param {object} opts
 * @param {string} opts.appName       e.g. 'ProjectFlow AI' or 'HRMS'
 * @param {string} opts.appDescription
 * @param {string} opts.publicHost    LAN IP so the Share link can point at this host
 */
function buildEnvJs(opts) {
  const env = {
    // Relative — the proxy below forwards /api/* to the API. PMT prepends
    // /api/<version> itself, so VITE_API_URL is the empty/relative base.
    VITE_API_URL: '',
    VITE_API_VERSION: 'v1',
    // HRMS builds its axios baseURL as `VITE_API_BASE_URL || VITE_API_URL/version`.
    // With VITE_API_URL='' that would resolve to "/v1" (missing /api), so set the
    // full base explicitly. PMT ignores this key (it hardcodes /api/v1).
    VITE_API_BASE_URL: '/api/v1',
    // HRMS reads uploads off this base; same-origin proxy forwards /uploads.
    VITE_UPLOADS_BASE_URL: '',
    VITE_WS_URL: '', // same-origin socket.io; the proxy upgrades /api ws too
    VITE_APP_NAME: opts.appName,
    VITE_APP_DESCRIPTION: opts.appDescription,
    VITE_AUTH_MODE: 'jwt',
    PUBLIC_HOST: opts.publicHost || '',
    // Keycloak vars intentionally blank in jwt mode.
    VITE_KEYCLOAK_URL: '',
    VITE_KEYCLOAK_REALM: '',
    VITE_KEYCLOAK_CLIENT_ID: '',
  };
  return `window.__ENV__ = ${JSON.stringify(env, null, 2)};\n`;
}

function safeJoin(root, urlPath) {
  // Strip query string and decode, then resolve within root to prevent
  // directory traversal (../../etc/passwd).
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.normalize(path.join(root, clean));
  if (!resolved.startsWith(path.normalize(root))) return null;
  return resolved;
}

/** Proxy a request/response pair to the API backend. Streams both ways.
 *  Every stream gets an error handler: if the browser disconnects mid-request,
 *  the sockets emit ECONNABORTED/ECONNRESET/EPIPE — we swallow those (they are
 *  benign) so a dropped connection can never crash the process. */
function proxyToApi(req, res) {
  const options = {
    host: API_HOST,
    port: API_PORT,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `${API_HOST}:${API_PORT}` },
  };

  const upstream = http.request(options, (upRes) => {
    if (res.destroyed || res.writableEnded) { upRes.destroy(); return; }
    try {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
    } catch { upRes.destroy(); return; }
    upRes.on('error', () => { try { res.destroy(); } catch {} });
    upRes.pipe(res);
  });

  // Client (browser) went away or errored -> abort the upstream request.
  const onClientGone = () => { try { upstream.destroy(); } catch {} };
  req.on('error', onClientGone);
  res.on('error', onClientGone);
  res.on('close', onClientGone);

  upstream.on('error', (err) => {
    if (!res.headersSent && !res.destroyed) {
      try {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Bad gateway: API unreachable (${err.code || err.message})`);
      } catch {}
    } else {
      try { res.destroy(); } catch {}
    }
  });

  req.pipe(upstream);
}

/**
 * Create and start one static+proxy server for a single SPA.
 *
 * @param {object} opts
 * @param {string} opts.root      absolute path to the built SPA (contains index.html)
 * @param {number} opts.port      listen port (3000 hrms / 3001 pmt)
 * @param {string} opts.appName
 * @param {string} opts.appDescription
 * @param {() => string} opts.getPublicHost  callback returning current LAN IP
 * @returns {import('http').Server}
 */
function createSpaServer(opts) {
  const { root, port, appName, appDescription, getPublicHost } = opts;
  const indexHtml = path.join(root, 'index.html');

  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    // 1. Runtime env — must be served dynamically (LAN IP known only at runtime).
    if (urlPath === '/config/env.js') {
      const body = buildEnvJs({ appName, appDescription, publicHost: getPublicHost() });
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    // 2. Reverse-proxy backend traffic. The SPA hits these relative paths.
    if (urlPath === '/api' || urlPath.startsWith('/api/') ||
        urlPath === '/uploads' || urlPath.startsWith('/uploads/')) {
      proxyToApi(req, res);
      return;
    }

    // 3. Static files with SPA fallback.
    const filePath = safeJoin(root, urlPath === '/' ? '/index.html' : urlPath);
    if (!filePath) {
      res.writeHead(400).end('Bad request');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) {
        sendFile(res, filePath);
      } else {
        // Unknown route (no file + no extension) -> serve index.html so the
        // client router can handle it. Missing asset with an extension -> 404.
        if (path.extname(urlPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        } else {
          sendFile(res, indexHtml);
        }
      }
    });
  });

  // Proxy WebSocket upgrades (socket.io) through to the API as well.
  // Real-time sockets get abruptly closed all the time (page refresh/navigate),
  // so EVERY socket needs an 'error' handler — an unhandled ECONNRESET here would
  // otherwise crash the whole app.
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => { try { socket.destroy(); } catch {} });

    const upstream = http.request({
      host: API_HOST,
      port: API_PORT,
      method: req.method,
      path: req.url,
      headers: req.headers,
    });
    upstream.on('upgrade', (upRes, upSocket, upHead) => {
      upSocket.on('error', () => { try { upSocket.destroy(); } catch {} });
      // If either side dies, tear down the other so nothing writes to a dead socket.
      socket.on('close', () => { try { upSocket.destroy(); } catch {} });
      upSocket.on('close', () => { try { socket.destroy(); } catch {} });
      try {
        const headers = Object.entries(upRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n');
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`);
        if (upHead && upHead.length) upSocket.unshift(upHead);
        upSocket.pipe(socket);
        socket.pipe(upSocket);
      } catch { try { socket.destroy(); } catch {} try { upSocket.destroy(); } catch {} }
    });
    upstream.on('error', () => { try { socket.destroy(); } catch {} });
    if (head && head.length) upstream.write(head);
    upstream.end();
  });

  // 0.0.0.0 => reachable from the LAN.
  server.listen(port, '0.0.0.0', () => {
    console.log(`[server] ${appName} serving ${root} on 0.0.0.0:${port}`);
  });

  return server;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end('Read error');
    })
    .pipe(res);
}

module.exports = { createSpaServer };
