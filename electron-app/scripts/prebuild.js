#!/usr/bin/env node
/*
 * prebuild.js
 * ---------------------------------------------------------------------------
 * Prepares the `resources/` folder that electron-builder ships as
 * extraResources. It:
 *   1. Builds ../apps/api    (install dev deps, tsc build, prisma generate)
 *   2. Builds ../apps/pmt-web  (install, vite build)
 *   3. Builds ../apps/hrms-web (install, vite build)
 *   4. Copies:
 *        - api dist + prisma + a PRODUCTION-only node_modules -> ./resources/api
 *        - pmt-web dist  -> ./resources/pmt-web
 *        - hrms-web dist -> ./resources/hrms-web
 *
 * Cross-platform: pure Node fs + child_process (no bash). Runs identically on
 * Windows and macOS, which matters because each installer is built natively on
 * its own OS runner.
 *
 * Run from the electron-app directory:  node scripts/prebuild.js
 */

'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ELECTRON_APP_DIR = path.resolve(__dirname, '..');      // electron-app/
const REPO_ROOT = path.resolve(ELECTRON_APP_DIR, '..');      // one level up
const APPS_DIR = path.join(REPO_ROOT, 'apps');

const API_SRC = path.join(APPS_DIR, 'api');
const PMT_WEB_SRC = path.join(APPS_DIR, 'pmt-web');
const HRMS_WEB_SRC = path.join(APPS_DIR, 'hrms-web');

const RESOURCES_DIR = path.join(ELECTRON_APP_DIR, 'resources');
const RES_API = path.join(RESOURCES_DIR, 'api');
const RES_PMT_WEB = path.join(RESOURCES_DIR, 'pmt-web');
const RES_HRMS_WEB = path.join(RESOURCES_DIR, 'hrms-web');

// pnpm is the package manager used across the monorepo (see api package.json:
// "packageManager": "pnpm@10.20.0"). On CI we call `pnpm` directly.
const PNPM = process.env.PNPM_BIN || 'pnpm';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
let stepNo = 0;
function log(msg) {
  console.log(`\n[prebuild] ${msg}`);
}
function step(msg) {
  stepNo += 1;
  console.log(`\n========================================================`);
  console.log(`[prebuild] STEP ${stepNo}: ${msg}`);
  console.log(`========================================================`);
}

function run(cmd, cwd) {
  log(`$ ${cmd}   (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

// Recursive copy using the modern fs.cpSync (Node >= 16.7). Dereferences
// symlinks so the shipped copy is self-contained.
function copyDir(src, dest, { filter } = {}) {
  if (!fs.existsSync(src)) {
    throw new Error(`copyDir: source does not exist: ${src}`);
  }
  ensureDir(dest);
  fs.cpSync(src, dest, {
    recursive: true,
    dereference: true,
    force: true,
    filter,
  });
}

function assertExists(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(
      `Expected ${label} at "${p}" but it was not found. ` +
        `Did the corresponding build step succeed?`,
    );
  }
}

// ---------------------------------------------------------------------------
// 1. Build the API
// ---------------------------------------------------------------------------
function buildApi() {
  step('Build API (../apps/api)');

  // Install ALL deps (including dev) so tsc + prisma CLI are available.
  run(`${PNPM} install --prod=false`, API_SRC);

  // Generate the Prisma client FIRST — tsc needs its types (the `Prisma`
  // namespace + model types). Building before generate makes every Prisma type
  // resolve to `unknown` and tsc fails. (Matches the Docker order: generate && build.)
  run(`${PNPM} run prisma:generate`, API_SRC);

  // Compile TypeScript -> dist (api package.json: "build": "tsc").
  run(`${PNPM} run build`, API_SRC);
}

// ---------------------------------------------------------------------------
// 2 & 3. Build the web apps (Vite -> dist/)
// ---------------------------------------------------------------------------
function buildWeb(label, srcDir) {
  step(`Build ${label} (${path.relative(REPO_ROOT, srcDir)})`);
  run(`${PNPM} install`, srcDir);
  run(`${PNPM} run build`, srcDir);
}

// ---------------------------------------------------------------------------
// 4a. Copy API artifacts into resources/api
// ---------------------------------------------------------------------------
function stageApi() {
  step('Stage API into resources/api');

  rmrf(RES_API);
  ensureDir(RES_API);

  // --- dist ---
  const apiDist = path.join(API_SRC, 'dist');
  assertExists(apiDist, 'api dist (tsc output)');
  log('Copying api/dist -> resources/api/dist');
  copyDir(apiDist, path.join(RES_API, 'dist'));

  // --- prisma (schema + migrations + config) ---
  // The runtime needs schema.prisma + migrations to run `prisma migrate deploy`
  // against the bundled Postgres on first launch.
  const apiPrisma = path.join(API_SRC, 'prisma');
  assertExists(apiPrisma, 'api prisma directory');
  log('Copying api/prisma -> resources/api/prisma');
  copyDir(apiPrisma, path.join(RES_API, 'prisma'));

  // --- package.json (needed so `node dist/index.js` resolves module type,
  //     and so the prisma CLI can be invoked at runtime if desired) ---
  const apiPkg = path.join(API_SRC, 'package.json');
  assertExists(apiPkg, 'api package.json');
  log('Copying api/package.json -> resources/api/package.json');
  fs.copyFileSync(apiPkg, path.join(RES_API, 'package.json'));

  // --- PRODUCTION node_modules ---
  // We build a clean, production-only node_modules in a temp copy of the api so
  // dev tooling (tsc, jest, eslint, prisma CLI, etc.) is NOT shipped. This
  // keeps the installer small while retaining the runtime deps (express,
  // @prisma/client, the generated client, etc.).
  //
  // TODO(verify): with pnpm's default symlinked store, node_modules is a tree
  // of symlinks into a global store. copyDir dereferences symlinks so the
  // shipped copy is self-contained, but this makes it larger. If size is a
  // concern, run pnpm with `--config.node-linker=hoisted` (or a `.npmrc` with
  // `node-linker=hoisted`) in this staging dir to produce a flat, real-file
  // node_modules. Left as the safe (dereferenced) default here.
  const stagingApi = fs.mkdtempSync(path.join(os.tmpdir(), 'pmt-api-prod-'));
  try {
    log(`Preparing production node_modules in temp dir: ${stagingApi}`);
    fs.copyFileSync(apiPkg, path.join(stagingApi, 'package.json'));

    const apiLock = path.join(API_SRC, 'pnpm-lock.yaml');
    if (fs.existsSync(apiLock)) {
      fs.copyFileSync(apiLock, path.join(stagingApi, 'pnpm-lock.yaml'));
    }
    // A monorepo lockfile may live at the repo root. TODO(verify): if the api
    // is part of a pnpm workspace, `pnpm install --prod` here may need the
    // workspace lockfile or `--ignore-workspace`. Adjust if install fails.
    run(
      `${PNPM} install --prod --ignore-scripts --node-linker=hoisted`,
      stagingApi,
    );

    const prodModules = path.join(stagingApi, 'node_modules');
    assertExists(prodModules, 'production node_modules (staging)');
    log('Copying production node_modules -> resources/api/node_modules');
    copyDir(prodModules, path.join(RES_API, 'node_modules'));

    // Generate the Prisma client directly inside the staged node_modules so the
    // .prisma/client output lands at the correct hoisted path. The prod install
    // above used --ignore-scripts (so prisma's generate postinstall didn't run),
    // and with pnpm the dev-built client lives in the virtual store, not a
    // copyable apps/api/node_modules/.prisma. Runs under the prebuild's Node (>=22).
    log('Generating Prisma client inside resources/api ...');
    const prismaCliRel = fs.existsSync(path.join(RES_API, 'node_modules', 'prisma', 'build', 'index.js'))
      ? path.join('node_modules', 'prisma', 'build', 'index.js')
      : path.join('node_modules', 'prisma', 'dist', 'index.js');
    run(`node "${prismaCliRel}" generate --config prisma/prisma.config.mjs`, RES_API);
    assertExists(path.join(RES_API, 'node_modules', '.prisma', 'client'), 'generated .prisma/client');
  } finally {
    rmrf(stagingApi);
  }

  log('API staged successfully.');
}

// ---------------------------------------------------------------------------
// 4b. Copy a web app's dist into its resources folder
// ---------------------------------------------------------------------------
function stageWeb(label, srcDir, destDir) {
  step(`Stage ${label} into ${path.relative(ELECTRON_APP_DIR, destDir)}`);

  // Vite outputs to dist/ by default (neither vite.config declares a custom
  // outDir). TODO(verify): if a custom build.outDir is configured, update this.
  const dist = path.join(srcDir, 'dist');
  assertExists(dist, `${label} dist (vite build output)`);

  rmrf(destDir);
  ensureDir(destDir);
  log(`Copying ${label}/dist -> ${path.relative(ELECTRON_APP_DIR, destDir)}`);
  // Copy the CONTENTS of dist directly into destDir so the runtime can serve
  // index.html from resources/<web>/index.html.
  copyDir(dist, destDir);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  log(`Repo root:        ${REPO_ROOT}`);
  log(`Electron app dir: ${ELECTRON_APP_DIR}`);
  log(`Resources dir:    ${RESOURCES_DIR}`);

  // Sanity check the source apps exist before doing any work.
  assertExists(API_SRC, '../apps/api');
  assertExists(PMT_WEB_SRC, '../apps/pmt-web');
  assertExists(HRMS_WEB_SRC, '../apps/hrms-web');

  // Fresh resources dir each run.
  ensureDir(RESOURCES_DIR);

  // Build
  buildApi();
  buildWeb('pmt-web', PMT_WEB_SRC);
  buildWeb('hrms-web', HRMS_WEB_SRC);

  // Stage
  stageApi();
  stageWeb('pmt-web', PMT_WEB_SRC, RES_PMT_WEB);
  stageWeb('hrms-web', HRMS_WEB_SRC, RES_HRMS_WEB);

  step('DONE');
  log('resources/ prepared. You can now run electron-builder.');
  log(`  Windows:  npx electron-builder --win --config electron-builder.yml`);
  log(`  macOS:    npx electron-builder --mac --config electron-builder.yml`);
}

try {
  main();
} catch (err) {
  console.error(`\n[prebuild] FAILED: ${err && err.message ? err.message : err}`);
  process.exit(1);
}
