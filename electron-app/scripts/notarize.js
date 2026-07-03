/*
 * notarize.js
 * ---------------------------------------------------------------------------
 * electron-builder `afterSign` hook.
 *
 * Notarizes the macOS app with Apple's notary service using @electron/notarize.
 *
 * It is a NO-OP unless:
 *   - the platform being built is macOS, AND
 *   - all three of APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID are set.
 *
 * This lets Windows builds and un-credentialed local mac builds proceed without
 * failing. Notarization only happens in CI (or locally) when the Apple
 * credentials are present in the environment.
 *
 * Docs: https://www.electron.build/configuration/mac  (afterSign)
 *       https://github.com/electron/notarize
 */

'use strict';

const path = require('node:path');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds.
  if (electronPlatformName !== 'darwin') {
    console.log('[notarize] Skipping: not a macOS build.');
    return;
  }

  const {
    APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD,
    APPLE_TEAM_ID,
  } = process.env;

  // Skip gracefully when credentials are absent (e.g. local dev, PRs).
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      '[notarize] Skipping notarization: one or more of APPLE_ID, ' +
        'APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID is not set.',
    );
    return;
  }

  // Lazy-require so this hook doesn't hard-fail on machines that don't have the
  // package installed (e.g. Windows-only builders).
  let notarize;
  try {
    ({ notarize } = require('@electron/notarize'));
  } catch (err) {
    console.warn(
      '[notarize] @electron/notarize is not installed; skipping notarization. ' +
        'Install it as a devDependency to enable notarization.',
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[notarize] Notarizing ${appPath} with Apple notary service...`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log(`[notarize] Done notarizing ${appName}.`);
};
