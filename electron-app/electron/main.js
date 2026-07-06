'use strict';
// PMT-HRMS desktop main process.
//
// Boot sequence (on app "ready"):
//   1. Ensure the data dir (userData/data) exists — holds Postgres cluster,
//      uploads, and a generated secrets file.
//   2. Start embedded PostgreSQL 16 (creates the DB on first run).
//   3. Generate JWT secrets on first run; persist to the data dir. The admin
//      account is NOT auto-seeded anymore — the operator creates it via the
//      first-run setup screen (see setup.html).
//   4. Run `prisma migrate deploy` against the embedded PG using the bundled
//      API's prisma schema + migrations.
//   5. Fork the API (resources/api/dist/index.js) as a child process with
//      ELECTRON_RUN_AS_NODE=1 and the correct env — including a random
//      LOCAL_ADMIN_TOKEN so the app can call the host-only admin endpoints.
//   6. Start the two static SPA servers (HRMS :3000, PMT :3001) which also
//      reverse-proxy /api + /uploads to the API on :4000.
//   7. Poll http://127.0.0.1:4000/health until the API is up.
//   8. Ask the API whether an admin exists (GET /auth/local/status). If not,
//      open the window on setup.html; otherwise on the launcher.
//   9. Create a tray icon so closing the window keeps everything running;
//      Quit stops the API child then Postgres cleanly. The tray + menu bar
//      also expose a host-only "Reset admin password" action.

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const { fork, spawn } = require('node:child_process');

const { Database } = require('./db');
const { createSpaServer } = require('./server');
const { getLanIp } = require('./lan');

// ── Crash safety net ─────────────────────────────────────────────────────────
// The app runs local HTTP + WebSocket proxy servers. When a browser disconnects
// mid-request (navigate/refresh/close), Node emits socket write errors like
// ECONNABORTED/ECONNRESET/EPIPE. Left unhandled these become uncaught exceptions
// and Electron kills the WHOLE app. These are benign — log and keep running.
// Anything else is logged too, but we stay alive (this is a long-running server).
const BENIGN_NET_ERRORS = new Set(['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ERR_STREAM_DESTROYED']);
process.on('uncaughtException', (err) => {
  if (err && BENIGN_NET_ERRORS.has(err.code)) {
    console.warn('[main] ignored benign network error:', err.code);
    return;
  }
  console.error('[main] uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});

// ── Shared conventions (must match the rest of the stack) ───────────────────
const HRMS_PORT = 3000;
const PMT_PORT = 3001;
const API_PORT = 4000;
const API_HOST = '127.0.0.1';

// Single-instance lock: a second launch just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ── Path helpers ────────────────────────────────────────────────────────────
// In production, packaged resources live under process.resourcesPath/… (from
// electron-builder "extraResources"). In dev (`npm start`) we fall back to
// sibling ../resources so the app can run before packaging.
const RES_DIR = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '..', 'resources');

const API_DIR = path.join(RES_DIR, 'api');                 // dist + prisma + prod node_modules
const API_ENTRY = path.join(API_DIR, 'dist', 'index.js');  // confirmed: apps/api main = dist/index.js
const PMT_WEB_DIR = path.join(RES_DIR, 'pmt-web');         // built SPA
const HRMS_WEB_DIR = path.join(RES_DIR, 'hrms-web');       // built SPA
const ICON_PATH = path.join(__dirname, 'icon.png');        // Codespire mark (bundled in electron/)

// Data dir = userData/data (holds postgres data, uploads, secrets).
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const PG_DATA_DIR = path.join(DATA_DIR, 'postgres');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

// ── Runtime state ───────────────────────────────────────────────────────────
let db = null;
let apiChild = null;
let hrmsServer = null;
let pmtServer = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let publicHost = '127.0.0.1';

// Random per-launch token guarding the host-only admin endpoints on the API
// (127.0.0.1:4000). Generated once at startup, passed to the API child env as
// LOCAL_ADMIN_TOKEN, and sent as the `x-local-admin-token` header on our own
// calls. Never exposed to the renderer.
const LOCAL_ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');

// ─────────────────────────────────────────────────────────────────────────────
// Secrets: JWT signing keys, generated once and persisted. We deliberately do
// NOT store admin credentials here anymore — the admin account is created by
// the operator through the first-run setup screen (setup.html), and the API no
// longer auto-seeds one.
// ─────────────────────────────────────────────────────────────────────────────
function loadOrCreateSecrets() {
  if (fs.existsSync(SECRETS_FILE)) {
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  }
  const secrets = {
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
  };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return secrets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma 7's CLI + some API deps are ESM-only, and require() of ESM only works
// on Node >= 22. Electron >= 35 bundles Node 22, so we run the migration and the
// API as child processes of the Electron binary itself (process.execPath) with
// ELECTRON_RUN_AS_NODE=1 — i.e. Electron's OWN Node 22. This makes the packaged
// app fully self-contained: NO system Node install required on the user's machine.

// Run `prisma migrate deploy` against the embedded PG using the bundled API's
// prisma CLI, executed on Electron's own Node 22 (ELECTRON_RUN_AS_NODE).
// ─────────────────────────────────────────────────────────────────────────────
function runMigrations(databaseUrl) {
  return new Promise((resolve, reject) => {
    // Resolve the bundled prisma CLI entry inside the API's prod node_modules.
    // TODO(verify): confirm the CLI entry path for prisma 7.3.0. `prisma/build/index.js`
    // is the historical location; some builds expose it via package.json "bin".
    // We probe a couple of known locations and fall back to the bin path.
    const prismaCandidates = [
      path.join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js'),
      path.join(API_DIR, 'node_modules', 'prisma', 'dist', 'index.js'),
    ];
    const prismaBin = prismaCandidates.find((p) => fs.existsSync(p)) || prismaCandidates[0];
    // apps/api uses a JS prisma config in the container (prisma.config.mjs).
    const prismaConfig = path.join('prisma', 'prisma.config.mjs');

    console.log('[main] Running prisma migrate deploy...');
    const child = spawn(process.execPath, [prismaBin, 'migrate', 'deploy', '--config', prismaConfig], {
      cwd: API_DIR, // prisma resolves schema/migrations relative to cwd (matches entrypoint)
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1', // run the Electron binary as plain Node (v22)
        DATABASE_URL: databaseUrl,
      },
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log('[main] Migrations applied.');
        resolve();
      } else {
        reject(new Error(`prisma migrate deploy exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fork the API as a child process. ELECTRON_RUN_AS_NODE makes Electron behave
// as plain Node so we can run the compiled Express server (dist/index.js).
// ─────────────────────────────────────────────────────────────────────────────
function startApi(databaseUrl, secrets) {
  const apiEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1', // run the API on Electron's own Node 22 (self-contained)
    NODE_ENV: 'production',

    // Server
    PORT: String(API_PORT),
    HOST: '0.0.0.0', // LAN-reachable (proxied via SPA servers, but explicit here)

    // Database — pass the full URL; the API uses it directly (config/index.ts).
    DATABASE_URL: databaseUrl,
    // config.validate() checks that these env vars are PRESENT (not just that
    // config resolves), so we must also set the split parts even though
    // DATABASE_URL already carries the connection. Values mirror db.js.
    DATABASE_HOST: '127.0.0.1',
    // The embedded cluster binds to a fresh free port every launch (db.js
    // getFreePort()) so it never collides with a system Postgres already
    // using 5432 — mirror whatever port it actually picked, not a fixed one.
    DATABASE_PORT: String(db.port),
    DATABASE_NAME: db.databaseName,
    DATABASE_USER: 'postgres',
    DATABASE_PASSWORD: 'postgres',

    // Auth: self-contained JWT mode (no Keycloak).
    AUTH_MODE: 'jwt',
    // The desktop app serves over plain HTTP on the LAN, so the auth cookies
    // must NOT be marked Secure (browsers drop Secure cookies over HTTP, which
    // would break httpOnly-cookie auth). Explicit so it never ties to NODE_ENV.
    COOKIE_SECURE: 'false',
    JWT_SECRET: secrets.JWT_SECRET,
    JWT_REFRESH_SECRET: secrets.JWT_REFRESH_SECRET,
    // No ADMIN_EMAIL/ADMIN_PASSWORD: the API must NOT auto-seed an admin. The
    // operator creates the first admin via the setup screen, which calls the
    // host-only create-admin endpoint guarded by this token.
    LOCAL_ADMIN_TOKEN: LOCAL_ADMIN_TOKEN,

    // File uploads live in the data dir so they persist and are writable.
    UPLOAD_DIR: UPLOAD_DIR,

    // Frontend URLs + CORS: LAN-aware so links/emails and cross-origin work.
    FRONTEND_URL: `http://localhost:${PMT_PORT}`,
    HRMS_FRONTEND_URL: `http://localhost:${HRMS_PORT}`,
    CORS_ORIGINS: [
      `http://localhost:${PMT_PORT}`,
      `http://localhost:${HRMS_PORT}`,
      `http://127.0.0.1:${PMT_PORT}`,
      `http://127.0.0.1:${HRMS_PORT}`,
      `http://${publicHost}:${PMT_PORT}`,
      `http://${publicHost}:${HRMS_PORT}`,
    ].join(','),

    // TODO(verify): Redis is optional in config/index.ts (caching disabled if
    // unset). We leave REDIS_HOST unset intentionally — confirm nothing hard-
    // requires Redis at boot in this build.
  };

  console.log('[main] Starting API (Electron-as-Node):', API_ENTRY);
  apiChild = spawn(process.execPath, [API_ENTRY], {
    cwd: API_DIR, // so relative prisma/schema and any cwd-relative paths resolve
    env: apiEnv,
    stdio: 'inherit',
  });

  apiChild.on('exit', (code, signal) => {
    console.error(`[main] API child exited (code=${code} signal=${signal})`);
    apiChild = null;
    if (!isQuitting) {
      dialog.showErrorBox('API stopped', `The backend API process exited unexpectedly (code ${code}).`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll the API /health endpoint until it responds 200 (or time out).
// ─────────────────────────────────────────────────────────────────────────────
function waitForApi(timeoutMs = 180000, intervalMs = 750) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(
        { host: API_HOST, port: API_PORT, path: '/health', timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          retry();
        }
      );
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error('API health check timed out'));
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Host-only admin API helper. Calls the API's /api/v1/auth/local/* endpoints on
// 127.0.0.1:4000 with the x-local-admin-token header. Uses Node's built-in
// fetch (Electron 33 exposes a global fetch). Returns { ok, status, data }.
// ─────────────────────────────────────────────────────────────────────────────
async function localAdminApi(method, endpoint, body) {
  const url = `http://${API_HOST}:${API_PORT}/api/v1/auth/local/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-local-admin-token': LOCAL_ADMIN_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON / empty body */ }
  return { ok: res.ok, status: res.status, data };
}

// True if the API reports at least one admin account exists.
async function apiHasAdmin() {
  const { ok, data } = await localAdminApi('GET', 'status');
  return !!(ok && data && data.data && data.data.hasAdmin);
}

// ─────────────────────────────────────────────────────────────────────────────
// Static SPA servers (also proxy /api + /uploads to the API).
// ─────────────────────────────────────────────────────────────────────────────
function startWebServers() {
  hrmsServer = createSpaServer({
    root: HRMS_WEB_DIR,
    port: HRMS_PORT,
    appName: 'HRMS',
    appDescription: 'Human Resource Management System',
    getPublicHost: () => publicHost,
  });
  pmtServer = createSpaServer({
    root: PMT_WEB_DIR,
    port: PMT_PORT,
    appName: 'ProjectFlow AI',
    appDescription: 'AI-Powered Project Management Platform',
    getPublicHost: () => publicHost,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Window + tray
// ─────────────────────────────────────────────────────────────────────────────
// startPage: 'setup' loads the first-run admin setup screen; anything else
// loads the launcher landing page.
function createWindow(startPage) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Codespire PMT-HRMS',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (startPage === 'setup') {
    // First run: no admin yet — collect one before showing the launcher.
    mainWindow.loadFile(path.join(__dirname, 'setup.html'));
  } else {
    // Start on the launcher landing page (buttons choose which UI to open).
    mainWindow.loadFile(path.join(__dirname, 'launcher', 'index.html'));
  }

  // Always-visible "Apps" menu bar so PMT/HRMS are switchable at any time.
  buildAppMenu();

  // Close hides to tray instead of quitting (keep servers running).
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function loadUi(which) {
  const port = which === 'hrms' ? HRMS_PORT : PMT_PORT;
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.loadURL(`http://localhost:${port}`);
}

// Go back to the launcher (the "choose PMT or HRMS" screen).
function loadHome() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  mainWindow.show();
  mainWindow.loadFile(path.join(__dirname, 'launcher', 'index.html'));
}

// Always-visible menu bar so the user can switch between PMT and HRMS at any
// time (not just from the first launcher screen).
function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  // Shared Quit item. Binding CmdOrCtrl+Q guarantees the keyboard shortcut is
  // wired to a REAL quit on every platform (the before-quit handler then cleans
  // up the API + Postgres). Setting isQuitting here too is belt-and-suspenders.
  const quitItem = {
    label: 'Quit Codespire PMT-HRMS',
    accelerator: 'CmdOrCtrl+Q',
    click: () => { isQuitting = true; app.quit(); },
  };

  const template = [
    // macOS turns the FIRST submenu into the bold application menu. Without a
    // proper one, Cmd+Q has nothing to bind to and macOS users get no standard
    // Quit — a big reason the app felt un-closable on Mac. Provide the expected
    // roles (About / Hide / Quit ⌘Q).
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            quitItem,
          ],
        }]
      : []),
    {
      label: 'Apps',
      submenu: [
        // Cmd+H is the system Hide shortcut on macOS, so use Shift+H for Home to
        // avoid clobbering it.
        { label: 'Home (choose app)', accelerator: 'CmdOrCtrl+Shift+H', click: () => loadHome() },
        { type: 'separator' },
        { label: 'Open PMT (Project Management)', accelerator: 'CmdOrCtrl+1', click: () => loadUi('pmt') },
        { label: 'Open HRMS (HR Management)', accelerator: 'CmdOrCtrl+2', click: () => loadUi('hrms') },
        { type: 'separator' },
        quitItem,
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Reset admin password…', click: () => openResetWindow() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  // Codespire mark for the tray (bundled at electron/icon.png).
  let image = nativeImage.createFromPath(ICON_PATH);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip('Codespire PMT-HRMS');
  const menu = Menu.buildFromTemplate([
    { label: 'Home (choose app)', click: () => loadHome() },
    { label: 'Open PMT', click: () => loadUi('pmt') },
    { label: 'Open HRMS', click: () => loadUi('hrms') },
    { type: 'separator' },
    {
      label: 'Open share links…',
      click: () => {
        shell.openExternal(`http://${publicHost}:${PMT_PORT}`);
      },
    },
    { label: 'Reset admin password…', click: () => openResetWindow() },
    { type: 'separator' },
    { label: 'Quit Codespire PMT-HRMS', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) mainWindow.show(); });
}

// Small modal window for resetting the admin password (host-only, via the
// LOCAL_ADMIN_TOKEN). Reuses the existing preload so reset.html can call the
// same context-bridge API.
let resetWindow = null;
function openResetWindow() {
  if (resetWindow && !resetWindow.isDestroyed()) {
    resetWindow.show();
    resetWindow.focus();
    return;
  }
  resetWindow = new BrowserWindow({
    width: 460,
    height: 420,
    title: 'Reset admin password',
    icon: ICON_PATH,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  resetWindow.setMenuBarVisibility(false);
  resetWindow.loadFile(path.join(__dirname, 'reset.html'));
  resetWindow.on('closed', () => { resetWindow = null; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot orchestration
// ─────────────────────────────────────────────────────────────────────────────
async function boot() {
  // 1. Data dirs.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  // Detect LAN IP up front (used in API CORS + share links).
  publicHost = getLanIp();
  console.log('[main] LAN host:', publicHost);

  // 2. Embedded Postgres.
  db = new Database(PG_DATA_DIR);
  const databaseUrl = await db.start();

  // 3. Secrets (JWT signing keys only; admin is created via the setup screen).
  const secrets = loadOrCreateSecrets();

  // 4. Migrations.
  await runMigrations(databaseUrl);

  // 5. API child.
  startApi(databaseUrl, secrets);

  // 6. Static SPA servers.
  startWebServers();

  // 7. Wait for API health.
  await waitForApi();
  console.log('[main] API is healthy.');

  // 8. Decide the landing page: if no admin exists yet, show the first-run
  //    setup screen so the operator can create one; otherwise the launcher.
  let hasAdmin = false;
  try {
    hasAdmin = await apiHasAdmin();
  } catch (err) {
    // If the status check fails, fall back to setup so the operator can still
    // create an account rather than being stranded on a login they can't pass.
    console.error('[main] auth/local/status check failed:', err);
  }
  console.log('[main] hasAdmin:', hasAdmin);

  // 9. Window + tray.
  createWindow(hasAdmin ? 'launcher' : 'setup');
  createTray();

  // 10. Auto-update (packaged builds only; no-op + never crashes otherwise).
  initAutoUpdate();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-update (electron-updater).
//
// Reads the same `publish:` config as electron-builder (GitHub provider) from
// the packaged app-update.yml. Guarded so it is a complete no-op in dev / when
// the app is not packaged. Wrapped in try/catch and given an 'error' handler so
// an unreachable update server (offline, no release yet, rate-limited) can never
// crash the app — it just logs and the app keeps running normally.
// ─────────────────────────────────────────────────────────────────────────────
function initAutoUpdate() {
  // Dev / unpackaged: electron-updater has no app-update.yml and would throw.
  if (!app.isPackaged) {
    console.log('[updater] Skipping auto-update: app is not packaged (dev mode).');
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');

    // Keep it quiet + non-blocking; we drive the restart prompt ourselves.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] Checking for update...');
    });
    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info && info.version);
    });
    autoUpdater.on('update-not-available', (info) => {
      console.log('[updater] No update available (current is latest):', info && info.version);
    });
    autoUpdater.on('download-progress', (p) => {
      if (p && typeof p.percent === 'number') {
        console.log(`[updater] Downloading update: ${p.percent.toFixed(0)}%`);
      }
    });
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info && info.version);
      const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      dialog
        .showMessageBox(parent, {
          type: 'info',
          title: 'Update ready',
          message: 'A new version of Codespire PMT-HRMS has been downloaded.',
          detail:
            `Version ${info && info.version ? info.version : ''} is ready to install. ` +
            'Restart now to apply it, or it will be installed automatically the next ' +
            'time you quit the app. All your data is preserved.',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            // Ensure our own clean-shutdown path (stop API child + Postgres) runs.
            isQuitting = true;
            try {
              autoUpdater.quitAndInstall();
            } catch (err) {
              console.error('[updater] quitAndInstall failed:', err);
            }
          }
        })
        .catch((err) => console.error('[updater] update-downloaded dialog failed:', err));
    });
    autoUpdater.on('error', (err) => {
      // Never fatal: offline, no published release yet, GitHub rate limit, etc.
      console.error('[updater] Auto-update error (non-fatal):', err && err.message ? err.message : err);
    });

    // Fire-and-forget; returns a promise we also guard so a rejection can't
    // become an unhandled rejection that trips the crash net above.
    Promise.resolve(autoUpdater.checkForUpdatesAndNotify()).catch((err) => {
      console.error('[updater] checkForUpdatesAndNotify failed (non-fatal):', err && err.message ? err.message : err);
    });
  } catch (err) {
    // e.g. electron-updater not installed, or no update config bundled.
    console.error('[updater] Auto-update init skipped (non-fatal):', err && err.message ? err.message : err);
  }
}

// ── IPC for the launcher page ────────────────────────────────────────────────
ipcMain.on('open-ui', (_evt, which) => loadUi(which));
ipcMain.handle('get-share-info', () => ({
  publicHost,
  pmtPort: PMT_PORT,
  hrmsPort: HRMS_PORT,
  apiPort: API_PORT,
}));

// ── IPC for the first-run setup screen (setup.html) ──────────────────────────
// Report whether an admin already exists (used to guard/skip the form).
ipcMain.handle('setup:get-state', async () => {
  try {
    return { hasAdmin: await apiHasAdmin() };
  } catch (err) {
    return { hasAdmin: false, error: String(err && err.message ? err.message : err) };
  }
});

// Create the first admin account via the host-only endpoint, then load the
// launcher on success.
ipcMain.handle('setup:create-admin', async (_evt, payload) => {
  const email = (payload && payload.email || '').trim();
  const password = payload && payload.password || '';
  const firstName = payload && payload.firstName;
  const lastName = payload && payload.lastName;
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }
  try {
    const { ok, status, data } = await localAdminApi('POST', 'create-admin', {
      email, password, firstName, lastName,
    });
    if (ok) {
      // Swap the window from setup to the launcher.
      loadHome();
      return { success: true };
    }
    if (status === 409) {
      // An admin already exists — just proceed to the launcher.
      loadHome();
      return { success: true, alreadyExists: true };
    }
    return {
      success: false,
      error: (data && (data.message || (data.error && data.error.message))) || `Request failed (HTTP ${status}).`,
    };
  } catch (err) {
    return { success: false, error: String(err && err.message ? err.message : err) };
  }
});

// ── IPC for the reset-password window (reset.html) ───────────────────────────
ipcMain.handle('reset:reset-admin', async (_evt, payload) => {
  const password = payload && payload.password || '';
  const email = payload && payload.email ? String(payload.email).trim() : undefined;
  if (!password) {
    return { success: false, error: 'A new password is required.' };
  }
  try {
    const body = email ? { password, email } : { password };
    const { ok, status, data } = await localAdminApi('POST', 'reset-admin', body);
    if (ok) {
      const resetEmail = (data && data.data && data.data.email) || email || '(primary admin)';
      // Confirmation dialog: password changed, all data preserved.
      dialog.showMessageBox(resetWindow && !resetWindow.isDestroyed() ? resetWindow : mainWindow, {
        type: 'info',
        title: 'Admin password reset',
        message: 'The admin password was changed successfully.',
        detail:
          `Account: ${resetEmail}\n\n` +
          'The new password is now active. All existing data (projects, employees, ' +
          'settings) has been preserved — only the password changed.',
        buttons: ['OK'],
      });
      if (resetWindow && !resetWindow.isDestroyed()) resetWindow.close();
      return { success: true, email: resetEmail };
    }
    return {
      success: false,
      error: (data && (data.message || (data.error && data.error.message))) || `Request failed (HTTP ${status}).`,
    };
  } catch (err) {
    return { success: false, error: String(err && err.message ? err.message : err) };
  }
});

// Generate a strong random password for the reset helper.
ipcMain.handle('reset:generate-password', () => {
  // URL-safe, ~24 chars of entropy, easy to copy.
  return crypto.randomBytes(18).toString('base64url');
});

// ── App lifecycle ────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

app.whenReady().then(() => {
  boot().catch((err) => {
    console.error('[main] Boot failed:', err);
    dialog.showErrorBox('Codespire PMT-HRMS failed to start', String(err && err.stack ? err.stack : err));
    isQuitting = true;
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

// Keep running when all windows are closed (tray app). Only real Quit exits.
app.on('window-all-closed', (e) => {
  // Do nothing: on all platforms we stay alive in the tray until explicit Quit.
});

// Clean shutdown: stop API child, then Postgres.
//
// CRITICAL: set `isQuitting = true` FIRST, unconditionally. Any quit request —
// Cmd+Q, Dock > Quit, the macOS app menu, the OS shutting down, or our own
// menu/tray Quit — routes through here. If we don't flip the flag before the
// window's `close` handler runs, that handler calls preventDefault()+hide() and
// silently swallows the quit, making the app impossible to close (the exact
// macOS "it won't quit / had to kill it from Terminal" symptom).
let shuttingDown = false;
app.on('before-quit', async (e) => {
  isQuitting = true;

  // Nothing left to tear down (or a teardown is already in flight) → let the
  // default quit proceed so the app actually exits.
  if (shuttingDown || (!apiChild && !db && !hrmsServer && !pmtServer)) return;

  shuttingDown = true;
  e.preventDefault();

  // Never let a slow/hung teardown (e.g. Postgres taking a while to stop)
  // prevent the app from actually quitting — force-exit after a timeout so
  // Cmd+Q / Dock Quit / tray Quit always works within a bounded time.
  const forceExitTimer = setTimeout(() => {
    console.error('[main] Shutdown timed out after 5s — forcing exit.');
    app.exit(0);
  }, 5000);
  forceExitTimer.unref();

  try {
    if (apiChild) {
      console.log('[main] Stopping API child...');
      apiChild.kill('SIGTERM');
      apiChild = null;
    }
    if (hrmsServer) { try { hrmsServer.close(); } catch { /* already closed */ } hrmsServer = null; }
    if (pmtServer) { try { pmtServer.close(); } catch { /* already closed */ } pmtServer = null; }
    if (db) { await db.stop(); db = null; }
  } catch (err) {
    console.error('[main] Error during shutdown:', err);
  } finally {
    clearTimeout(forceExitTimer);
    app.exit(0);
  }
});

// Ensure quit flag is set when quit is triggered from menu/OS.
app.on('quit', () => { isQuitting = true; });
