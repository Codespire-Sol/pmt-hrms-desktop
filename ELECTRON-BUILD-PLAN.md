# PMT + HRMS — Electron Desktop App Build Plan (Windows + Mac)

Goal: a **downloadable app** — `.exe` (Windows) and `.dmg`/`.app` (Mac) — that a
non-coder installs and uses directly. **No Docker.** The host runs it; the team
still connects by browser on the LAN.

---

## 0. Verdict: Electron works on BOTH Windows and Mac
Electron builds native installers for Windows, macOS (Intel + Apple Silicon), and
Linux from one codebase. Confirmed fit. We bundle the Node backend + an embedded
PostgreSQL inside the app.

---

## 1. Architecture

```
  ┌──────────────────── Electron App (.exe / .app) ─────────────────────┐
  │  MAIN PROCESS (Node)                                                 │
  │   1. starts embedded PostgreSQL (local data folder, no Docker)       │
  │   2. runs DB migrations on first launch                              │
  │   3. starts the bundled Express API (your existing backend)          │
  │   4. serves the PMT + HRMS web UIs over HTTP on 0.0.0.0              │
  │   5. opens a window that loads the UI                                │
  │   6. lives in the system tray (keeps serving when window closed)     │
  └─────────────────────────────────────────────────────────────────────┘
        │ window (host user)              │ HTTP on LAN (teammates' browsers)
        ▼                                 ▼
   Native app window            http://<host-ip>:3000 / :3001
```

Multi-user is preserved: the app IS the server; teammates connect exactly like the
Docker version.

---

## 2. Locked technical decisions
| Area | Decision | Why |
|------|----------|-----|
| Shell | **Electron** + `electron-builder` | Cross-platform installers, bundles Node |
| Database | **Embedded PostgreSQL** (`embedded-postgres` npm) | Real Postgres, no Docker; Prisma stays unchanged |
| pgvector | **Removed** | Not used by the Node API; only AI search needed it, which is already off |
| Redis | **Removed** | Single host — in-memory cache + single-node Socket.IO |
| Backend | Reuse the **existing Express API** as-is | No rewrite; runs as a child process |
| Frontends | Serve existing **built** PMT + HRMS over HTTP | Replaces nginx; same runtime `window.__ENV__` injection |
| Auth | Local **JWT** (unchanged) | Already built |
| Data location | OS app-data folder (`app.getPath('userData')`) | Easy backup; survives app updates |

---

## 3. Repo / project structure
```
pmt-hrms-desktop/
├── electron/
│   ├── main.js            # boots DB + API, creates window, tray
│   ├── preload.js
│   ├── db.js              # embedded-postgres lifecycle + migrations
│   ├── server.js          # starts API + serves the two UIs on the LAN
│   └── share-window.html  # "your links / allow team access" screen
├── resources/
│   ├── api/               # compiled backend (dist + prod node_modules + prisma)
│   ├── pmt-web/           # built PMT static files
│   └── hrms-web/          # built HRMS static files
├── build/                 # icons (.ico / .icns), entitlements
├── package.json           # electron-builder config (win + mac targets)
└── scripts/               # prebuild: build api + both webs, copy into resources/
```

---

## 4. Build phases

### Phase 1 — Backend adaptation (make it Docker-free) · ~4–6 days
- [ ] **Remove the pgvector migration**: replace the `CREATE EXTENSION vector` /
      `issue_embeddings` migration with a no-op (or drop the table) so plain
      Postgres migrates cleanly.
- [ ] **Redis-optional**: add an in-memory fallback for the cache service and run
      Socket.IO without the Redis adapter when `REDIS_URL` is unset. Verify no code
      path hard-requires Redis.
- [ ] **Config**: allow the API to read DB connection + `AUTH_MODE=jwt` from values
      the Electron main process passes in (env), same as today.
- [ ] Confirm the API boots against a plain PostgreSQL with no Docker.

### Phase 2 — Embedded database · ~3–4 days
- [ ] Integrate `embedded-postgres`: download/start a Postgres binary into the
      app-data folder, create the DB on first run.
- [ ] Run `prisma migrate deploy` on first launch; seed admin + RBAC (existing code).
- [ ] Handle upgrades (migrate on version change) and a clean shutdown of Postgres.

### Phase 3 — Electron shell · ~5–7 days
- [ ] `main.js`: on launch → start DB → start API (child process) → wait healthy →
      open window loading the local UI.
- [ ] Serve PMT + HRMS built files over HTTP on `0.0.0.0` (ports 3000/3001 or one
      port with two paths) with the runtime `window.__ENV__` injection.
- [ ] A small **home/launcher** screen in the window with "Open PMT" / "Open HRMS".
- [ ] Generate secrets (JWT, admin password) + `.env`-equivalent on first run,
      stored in app-data. Show the admin password once.

### Phase 4 — Team sharing + tray · ~2–3 days
- [ ] Detect LAN IP; show a **Share** screen with the team links.
- [ ] **System tray** icon so closing the window keeps the server running.
- [ ] "Allow team access" button → adds the Windows Firewall rule (macOS: guidance).
- [ ] "Stop / Quit" that shuts the API + Postgres down cleanly.

### Phase 5 — Packaging · ~3–5 days
- [ ] `electron-builder`: **Windows NSIS `.exe`** installer + **Mac `.dmg`**
      (universal: Intel + Apple Silicon).
- [ ] Bundle the correct Postgres binary per platform; app icons; installer UX.
- [ ] Data persists across app updates (in app-data, not app folder).

### Phase 6 — Signing & notarization · ~2–4 days (+ accounts)
- [ ] **Windows code signing** (cert) so SmartScreen doesn't block the `.exe`.
- [ ] **macOS**: sign with Apple Developer ID + **notarize** (required or macOS blocks it).

### Phase 7 — Testing · ~3–5 days
- [ ] Fresh install on clean Windows 10/11 and macOS (Intel + Apple Silicon).
- [ ] Verify: first-run setup, login, add users/roles, SMTP + test email, attendance,
      biometric push, real-time updates, file uploads, team access from another PC.
- [ ] Backup/restore of the data folder; app update keeps data.

---

## 5. Data & backup
- All data (Postgres + uploads) lives in the OS app-data folder.
  - Windows: `%APPDATA%\PMT-HRMS\`  ·  macOS: `~/Library/Application Support/PMT-HRMS/`
- **Backup** = copy that folder (or a built-in "Backup now" button, easy to add).
- App updates don't touch it → no data loss on upgrade.

---

## 6. Risks & mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Embedded Postgres quirks per-OS (esp. Apple Silicon) | Medium | Use maintained `embedded-postgres`; test both archs early (Phase 2) |
| Redis removal misses a code path | Medium | Audit cache + socket usage; in-memory fallback + tests |
| First-launch migration time | Low | Progress screen "Setting up… one-time" |
| Bundle size ~250–400 MB | Low | Expected for Electron + Node + Postgres; acceptable for desktop |
| Signing/notarization setup | Medium | Budget accounts + certs up front (see Prereqs) |
| Two UIs in one window | Low | Launcher screen / open each in its own window |

---

## 7. Prerequisites & costs (tell the CEO)
- **Apple Developer account** — ~$99/yr (required to notarize the Mac app; otherwise
  macOS shows "unidentified developer" and blocks it).
- **Windows code-signing certificate** — ~$100–400/yr (so the `.exe` isn't
  SmartScreen-blocked). Optional but strongly recommended.
- A **Mac** is required to build/notarize the macOS version.

---

## 8. Timeline
| | Optimistic | Realistic |
|---|---|---|
| Working internal build (both OS, unsigned) | ~3 weeks | ~4 weeks |
| Signed, notarized, installer-polished, tested | ~5 weeks | ~6–7 weeks |

Single developer estimate. The backend adaptation (Phases 1–2) is the real work;
Electron shell + packaging is well-trodden.

---

## 9. Deliverables
1. `PMT-HRMS-Setup.exe` — Windows installer (double-click → app).
2. `PMT-HRMS.dmg` — macOS installer (drag to Applications).
3. Same features as the Docker edition **minus AI search** (already unused).
4. Team still connects by browser on the LAN; SMTP, attendance, biometric,
   real-time all work.
5. Updated user guide + backup instructions.

---

## 10. What we keep vs change
**Keep:** all business features, JWT auth, roles/permissions, attendance, biometric,
SMTP settings page, real-time, uploads, LAN team access.
**Change:** no Docker, no Redis, no pgvector/AI search; add embedded Postgres + a
native app window + tray.
