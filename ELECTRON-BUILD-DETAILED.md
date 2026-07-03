# PMT + HRMS — Detailed, Foolproof Build Playbook (.exe + .dmg)

The goal: produce a working **Windows `.exe`** and **macOS `.dmg`** with no surprises.
Follow this in order. Every known Electron pitfall is listed with its fix.

> **THE GOLDEN RULE (read first):**
> **Build each OS on that OS.** You CANNOT reliably build/notarize a Mac `.dmg` on
> Windows. The clean, "no-issues" path is **GitHub Actions** with a matrix that
> builds Windows on a Windows runner and Mac on a Mac runner. Local builds work too
> (need a Windows PC + a Mac). Cross-compiling is where 90% of "issues" come from —
> we avoid it entirely.

---

## 1. Prerequisites (get these BEFORE building)
| Need | For | Notes |
|------|-----|-------|
| Node.js 20 LTS + pnpm | Build everything | Same on both OS |
| A **Windows 10/11 PC** | Build the `.exe` | Or a Windows CI runner |
| A **Mac** (Apple Silicon ok) | Build + notarize the `.dmg` | Required — no way around it for Mac |
| **Apple Developer account** ($99/yr) | Sign + notarize Mac app | Get "Developer ID Application" cert |
| **Windows code-signing cert** ($100–400/yr) | Sign the `.exe` | Optional but avoids SmartScreen |
| App icons | Installers | `build/icon.ico` (Win), `build/icon.icns` (Mac), 512px `png` |

---

## 2. Exact dependencies
Electron app `package.json`:
```
devDependencies: electron, electron-builder, @electron/notarize
dependencies:    embedded-postgres        (bundles real Postgres, per-OS)
```
`embedded-postgres` pulls the platform binary via optional deps
(`@embedded-postgres/win32-x64`, `@embedded-postgres/darwin-arm64`,
`@embedded-postgres/darwin-x64`). electron-builder bundles whichever the target needs.

The **API** and **two web builds** are copied in as plain files (not npm deps) — see §4.

---

## 3. Backend prep (must be done before packaging) — from the main plan, Phase 1
1. **Remove the pgvector migration** (`CREATE EXTENSION vector` + `issue_embeddings`) →
   plain Postgres migrates cleanly. (You already confirmed pgvector is unused.)
2. **Make Redis optional** — in-memory cache + single-node Socket.IO when `REDIS_URL`
   is unset.
3. Confirm `pnpm build` in `apps/api` produces `dist/`, and `prisma migrate deploy`
   runs against a plain Postgres.
4. Build both frontends (`pnpm build` in `apps/pmt-web` and `apps/hrms-web`) →
   static `dist/` each.

---

## 4. Project layout
```
pmt-hrms-electron/
├── electron/
│   ├── main.js         # boot DB → boot API → serve UIs → window + tray
│   ├── db.js           # embedded-postgres start/stop + prisma migrate deploy
│   ├── server.js       # Express: serve pmt-web/hrms-web + inject window.__ENV__
│   └── preload.js
├── resources/          # produced by the prebuild script (§5)
│   ├── api/            # apps/api  dist + prisma + PROD node_modules
│   ├── pmt-web/        # apps/pmt-web/dist
│   └── hrms-web/       # apps/hrms-web/dist
├── build/              # icon.ico, icon.icns, entitlements.mac.plist
├── scripts/
│   ├── prebuild.js     # build api+webs, copy into resources/
│   └── notarize.js     # afterSign notarization hook
└── package.json        # electron-builder "build" config
```
**Why `resources/api` as plain files (not an npm dep):** it sidesteps all
asar/native-module headaches. The API (with its Prisma engine + bcrypt) lives outside
the asar and is run as a child process.

---

## 5. How the app runs (main.js responsibilities)
1. Resolve a writable **data dir** = `app.getPath('userData')/data`.
2. **Start embedded Postgres** into that data dir (first run: initialise + create DB).
3. Generate secrets + admin password on first run; store in the data dir.
4. **Run migrations**: `prisma migrate deploy` (point `DATABASE_URL` at the embedded PG).
5. **Fork the API** child process: run `resources/api/dist/index.js` with
   `ELECTRON_RUN_AS_NODE=1` and the right env (DB url, `AUTH_MODE=jwt`, ports).
6. **Serve the UIs** on `0.0.0.0` (3000 = HRMS, 3001 = PMT) with `window.__ENV__`
   injection (replaces nginx/docker-entrypoint).
7. Wait for API health → **open the window** (loads `http://localhost:3001`).
8. **System tray**: closing the window keeps serving; "Quit" stops API + Postgres cleanly.

---

## 6. electron-builder config (`package.json` → `"build"`)
```json
{
  "appId": "com.codespire.pmthrms",
  "productName": "PMT-HRMS",
  "directories": { "output": "release", "buildResources": "build" },
  "files": ["electron/**/*"],
  "extraResources": [
    { "from": "resources/api",      "to": "api" },
    { "from": "resources/pmt-web",  "to": "pmt-web" },
    { "from": "resources/hrms-web", "to": "hrms-web" }
  ],
  "asarUnpack": ["**/node_modules/@embedded-postgres/**"],
  "win":  { "target": ["nsis"], "icon": "build/icon.ico" },
  "nsis": { "oneClick": false, "perMachine": false, "allowToChangeInstallationDirectory": true },
  "mac":  {
    "target": [{ "target": "dmg", "arch": ["universal"] }],
    "icon": "build/icon.icns",
    "category": "public.app-category.business",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "afterSign": "scripts/notarize.js",
  "publish": [{ "provider": "github", "owner": "Codespire-Sol", "repo": "pmt-hrms-desktop" }]
}
```

---

## 7. The build commands
```bash
# once
pnpm install

# produce resources/ (builds api + both webs, copies them in)
node scripts/prebuild.js

# Windows (run ON Windows):
pnpm electron-builder --win --publish never      # -> release/PMT-HRMS-Setup.exe

# macOS (run ON a Mac):
pnpm electron-builder --mac --publish never       # -> release/PMT-HRMS.dmg
```

---

## 8. The pitfalls table — every known issue + its fix
| Pitfall | Symptom | Fix (baked into this plan) |
|--------|---------|----------------------------|
| Cross-building Mac on Windows | `.dmg`/notarize fails | **Build Mac on a Mac** (or macOS CI runner) |
| Prisma engine missing in package | API crashes: "query engine not found" | Ship API as **extraResources** (plain files) incl. its `node_modules` + `.prisma` |
| Native modules in asar (bcrypt, pg binary) | "cannot find module" / binary won't exec | API outside asar; `asarUnpack` the embedded-postgres binaries |
| embedded-postgres binary not bundled | "postgres binary not found" at runtime | Install the target's `@embedded-postgres/<os>-<arch>` and `asarUnpack` it |
| Postgres data dir not writable | Fails on user machines | Use `app.getPath('userData')`, never the install folder |
| Mac not notarized | "app is damaged / unidentified developer" | `hardenedRuntime` + entitlements + `afterSign` notarize hook |
| Windows unsigned | SmartScreen blocks | Code-sign in electron-builder (`win.certificateFile`/CI secret) |
| Wrong ports / firewall | Team can't connect | Serve on `0.0.0.0`; add firewall rule (Win) / prompt (Mac) |
| Postgres version drift | Data incompatible after update | **Pin one PG major version**; bundle it; never auto-change |
| App update wipes data | Data loss | Data in `userData` (survives updates); never in the app folder |
| Two UIs, one window | Confusing | Launcher screen or open each UI in its own window/tab |

---

## 9. macOS signing + notarization (the part people get wrong)
1. In Xcode/Apple account, create a **Developer ID Application** certificate; install it
   in the Mac's login keychain.
2. Create an **app-specific password** for notarization (appleid.apple.com).
3. `build/entitlements.mac.plist` — allow JIT/network for the bundled server.
4. `scripts/notarize.js` (afterSign) uses `@electron/notarize` with env:
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
5. Result: a `.dmg` users can open with no warnings.

## 9b. Windows signing
- Provide the cert to electron-builder via `CSC_LINK` + `CSC_KEY_PASSWORD`
  (file or CI secret). Result: `.exe` runs without SmartScreen warnings.

---

## 10. The reliable "one-shot both OS" path — GitHub Actions
This is the **recommended** way to build both perfectly, every time:
```yaml
name: build-desktop
on: { push: { tags: ['v*'] } }
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: corepack enable && pnpm install
      - run: node scripts/prebuild.js
      - run: pnpm electron-builder --publish always   # uploads to GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # mac secrets:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_PW }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.MAC_CERT_P12 }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERT_PW }}
          # windows secrets:
          WIN_CSC_LINK: ${{ secrets.WIN_CERT_PFX }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PW }}
```
Push a tag `v1.0.0` → GitHub builds **both** installers on their native runners,
signs, notarizes, and **uploads them to the Release**. One command, both OS, no local
cross-build pain. This is the "perfect, no issues" route.

---

## 11. Final QA checklist (run on clean machines)
- [ ] Fresh install on clean **Windows 10 + 11**, **macOS Intel + Apple Silicon**.
- [ ] First launch: sets up DB, shows admin password, opens window.
- [ ] Login → change password → add HR/manager/employee + roles.
- [ ] Credential Settings: set Company + SMTP → **Send test email** works.
- [ ] Attendance rules; biometric push from a device reaches the API.
- [ ] Real-time update shows on a second browser.
- [ ] Teammate on the LAN opens `http://<host-ip>:3000/3001` and logs in.
- [ ] File upload persists; restart app → data still there.
- [ ] Install a newer version → data preserved.
- [ ] Download the signed installers → **no SmartScreen / Gatekeeper warnings**.

---

## 12. Order of work (so nothing blocks later)
1. Backend Docker-free (pgvector out, Redis optional) — **do first**.
2. Embedded Postgres + migrations working locally.
3. Electron shell (window + API + serve UIs) on your dev OS.
4. Tray + LAN share + firewall.
5. Windows build on Windows; Mac build on Mac (unsigned first — prove it runs).
6. Add signing + notarization.
7. Wire GitHub Actions + publish to Releases.
8. Full QA on clean machines.

**If every box above is followed, the `.exe` and `.dmg` build cleanly and run with no
issues.** The two things that MUST NOT be skipped: build each OS natively, and keep
the API + binaries outside asar.
