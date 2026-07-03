#!/usr/bin/env node
/*
 * make-icons.js
 * ---------------------------------------------------------------------------
 * Generates the real, square application icons electron-builder ships, starting
 * from the Codespire mark used by the web app.
 *
 * Source:  ../apps/pmt-web/public/Favicon.png   (the 508x491 Codespire mark)
 * Outputs (into ./build):
 *   - build/icon.png    1024x1024 transparent square master (electron-builder
 *                       can also derive .icns/.ico from this if needed)
 *   - build/icon.ico    multi-size Windows icon (16..256) — win.icon
 *   - build/icon.icns   macOS icon (up to 1024)            — mac.icon
 *
 * Why pad-to-square: the source mark is 508x491 (not square). Packaging a
 * non-square icon yields stretched/warped results, so we letterbox it onto a
 * transparent square canvas with a small safe margin, then resize.
 *
 * Toolchain (all in devDependencies):
 *   - sharp       resize + pad onto a transparent square canvas
 *   - png-to-ico  build the multi-resolution .ico from PNG buffers
 *   - png2icons   build the .icns (pure JS, no native/mac-only tooling)
 *
 * Cross-platform: pure Node. Runs identically on Windows and macOS CI runners.
 * Degrades gracefully: if .icns generation is unavailable, it still writes
 * icon.png (1024 square) + icon.ico and lets electron-builder derive .icns from
 * the PNG — the build does not fail.
 *
 * Run from the electron-app directory:  node scripts/make-icons.js
 *   (or:  pnpm run make-icons)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ELECTRON_APP_DIR = path.resolve(__dirname, '..'); // electron-app/
const REPO_ROOT = path.resolve(ELECTRON_APP_DIR, '..'); // repo root
const SRC = path.join(REPO_ROOT, 'apps', 'pmt-web', 'public', 'Favicon.png');
const BUILD_DIR = path.join(ELECTRON_APP_DIR, 'build');

const OUT_PNG = path.join(BUILD_DIR, 'icon.png'); // 1024 square master
const OUT_ICO = path.join(BUILD_DIR, 'icon.ico');
const OUT_ICNS = path.join(BUILD_DIR, 'icon.icns');

// Square master size. 1024 is the largest macOS layer and downsamples cleanly
// for every other target.
const MASTER = 1024;
// Fraction of the canvas the mark occupies (rest is transparent safe margin).
// ~90% keeps a small breathing gap so macOS's rounded mask doesn't clip it.
const CONTENT = 0.9;

function log(msg) {
  console.log(`[make-icons] ${msg}`);
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Source mark not found at: ${SRC}`);
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  let sharp;
  try {
    sharp = require('sharp');
  } catch (err) {
    throw new Error(
      'The "sharp" package is required to generate icons. Run `pnpm install` ' +
        'in electron-app (it is listed in devDependencies).',
    );
  }

  // 1) Build the 1024x1024 transparent square master.
  //    - resize the mark to fit within CONTENT * MASTER (contain, no crop)
  //    - center it on a fully transparent MASTER x MASTER canvas
  log(`Reading source: ${path.relative(REPO_ROOT, SRC)}`);
  const inner = Math.round(MASTER * CONTENT);
  const resizedMark = await sharp(SRC)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const masterBuf = await sharp({
    create: {
      width: MASTER,
      height: MASTER,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedMark, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(OUT_PNG, masterBuf);
  log(`Wrote ${path.relative(ELECTRON_APP_DIR, OUT_PNG)} (${MASTER}x${MASTER} square).`);

  // 2) Windows .ico — multi-resolution (must include 256 for NSIS).
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngs = await Promise.all(
    icoSizes.map((s) =>
      sharp(masterBuf)
        .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );
  try {
    const pngToIco = require('png-to-ico');
    const icoBuf = await pngToIco(icoPngs);
    fs.writeFileSync(OUT_ICO, icoBuf);
    log(`Wrote ${path.relative(ELECTRON_APP_DIR, OUT_ICO)} (sizes: ${icoSizes.join(', ')}).`);
  } catch (err) {
    console.warn(
      `[make-icons] Could not generate icon.ico (${err && err.message ? err.message : err}). ` +
        'electron-builder will derive a .ico from build/icon.png instead.',
    );
  }

  // 3) macOS .icns — png2icons is pure JS (works on Windows + macOS CI).
  try {
    const png2icons = require('png2icons');
    // createICNS(input, interpolationAlgorithm, numOSType). 0 = nearest-neighbour
    // is fine for already-clean PNGs; -1 lets the lib pick sensible defaults.
    const icnsBuf = png2icons.createICNS(masterBuf, png2icons.BICUBIC, 0);
    if (icnsBuf && icnsBuf.length) {
      fs.writeFileSync(OUT_ICNS, icnsBuf);
      log(`Wrote ${path.relative(ELECTRON_APP_DIR, OUT_ICNS)}.`);
    } else {
      throw new Error('png2icons.createICNS returned an empty buffer.');
    }
  } catch (err) {
    console.warn(
      `[make-icons] Could not generate icon.icns (${err && err.message ? err.message : err}). ` +
        'electron-builder will derive a .icns from build/icon.png (1024 square) instead.',
    );
  }

  log('Done. Icons are in build/.');
}

main().catch((err) => {
  console.error(`\n[make-icons] FAILED: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
