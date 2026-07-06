/*
 * notarize.js
 * ---------------------------------------------------------------------------
 * electron-builder `afterSign` hook.
 *
 * Two jobs, both macOS-only:
 *
 * 1. Ad-hoc (re-)sign the bundle when no paid Developer ID cert (CSC_LINK) is
 *    configured. This is NOT redundant with electron-builder's own signing:
 *    with CSC_IDENTITY_AUTO_DISCOVERY=false (set in CI because there is no
 *    keychain identity to discover on a hosted runner), electron-builder skips
 *    macOS code signing ENTIRELY, regardless of `mac.identity` in
 *    electron-builder.yml. The app then ships with only Electron's own default
 *    per-binary placeholder signature, whose outer-bundle seal is invalidated
 *    once extraResources are copied in afterward (verified empirically: the
 *    shipped app showed `Identifier=Electron`, `Sealed Resources=none`). macOS
 *    treats that as a broken signature and shows a dead-end "app is damaged,
 *    move to Trash" dialog with no way for a user to open it. Explicitly
 *    running `codesign --sign -` here (exactly the command that fixes an
 *    already-installed broken build) guarantees a valid ad-hoc seal, which
 *    downgrades that to the normal, user-bypassable "unidentified developer"
 *    prompt.
 *
 * 2. Notarize with Apple's notary service using @electron/notarize — but only
 *    if all three of APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID are
 *    set. This lets Windows builds and un-credentialed local/CI mac builds
 *    proceed without failing.
 *
 * Docs: https://www.electron.build/configuration/mac  (afterSign)
 *       https://github.com/electron/notarize
 */

'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only relevant for macOS builds.
  if (electronPlatformName !== 'darwin') {
    console.log('[notarize] Skipping: not a macOS build.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Force an ad-hoc signature whenever we don't have a real Developer ID cert.
  // See the file header for why this can't be left to electron-builder alone.
  if (!process.env.CSC_LINK) {
    console.log(`[notarize] No CSC_LINK — ad-hoc signing ${appPath}...`);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    console.log('[notarize] Ad-hoc signing complete.');
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
