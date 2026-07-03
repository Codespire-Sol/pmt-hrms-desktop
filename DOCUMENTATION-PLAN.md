# Codespire PMT-HRMS — Documentation & Release Presentation Plan

Goal: make the GitHub repo look **enterprise-grade** and be **understandable by a
non-coder**, with **Codespire branding**, **screenshots of both apps**, and a clean
**download experience** — modeled on Joplin / Ferdium / balenaEtcher.

---

## A. What we're producing (deliverables)
1. **A polished `README.md`** — the "face" of the repo (branding, download, screenshots, features).
2. **A visual asset set** — Codespire logo/banner, badges, and screenshots of PMT + HRMS.
3. **Non-coder guides** in `docs/` — install, first-run, admin, user, FAQ (with pictures).
4. **A professional Releases presentation** — download table + release-notes template.

---

## B. The README layout (top → bottom) — the enterprise look
```
┌──────────────────────────────────────────────────────────┐
│              [ Codespire logo — centered ]                │   ← hero / branding
│            Codespire PMT-HRMS  (product name)             │
│   "Run Project Management + HR for your whole office,     │   ← one-line tagline
│    on one PC. No cloud. No subscriptions."                │
│   [version] [downloads] [license] [Windows] [macOS]       │   ← shields.io badges
├──────────────────────────────────────────────────────────┤
│  ⬇  DOWNLOAD                                              │
│   | Windows (.exe) | macOS (.dmg) |   → Latest Release    │   ← per-OS table
├──────────────────────────────────────────────────────────┤
│  📸  SCREENSHOTS                                          │
│   [ PMT dashboard ]      [ HRMS dashboard ]               │   ← side-by-side images
│   [ Boards/Sprints ]     [ Attendance ]                   │
├──────────────────────────────────────────────────────────┤
│  ✨  WHAT'S INSIDE   (PMT features | HRMS features)       │   ← feature grid w/ icons
│  🚀  GET STARTED IN 2 STEPS  (install → open)            │   ← non-coder quick start
│  📚  DOCUMENTATION   (links to the guides)               │
│  🛟  SUPPORT / CONTACT                                    │
│  ⚖️  LICENSE (Elastic 2.0)                               │
└──────────────────────────────────────────────────────────┘
```

### Badges (shields.io — auto-updating)
- `Latest release` · `Downloads` · `License: Elastic-2.0` · `Windows` · `macOS` · `Built with Electron`

### Download section (the key non-coder part)
A simple table with big, obvious per-OS links to the **latest release**, plus a
one-line "what to do after download" (Windows: run the Setup; Mac: drag to Applications).

---

## C. Visual assets to create
| Asset | Source | Use |
|---|---|---|
| **Codespire logo** | already in repo (`Favicon.png` mark + `Logo.png` wordmark) | README hero, docs headers |
| **Hero/banner** | compose logo + product name on a clean background | top of README |
| **Screenshots — PMT** | the running app: Dashboard, Boards/Sprints, Issues, Reports | screenshots section + user guide |
| **Screenshots — HRMS** | Dashboard, Employees, Attendance, Credential Settings | screenshots section + admin guide |
| **Badges** | shields.io URLs | under the title |
| **Step screenshots** | install flow, create-admin, tray menu | the install/admin guides |

Store them in `docs/images/` (e.g. `docs/images/pmt-dashboard.png`).

### How we get the screenshots (pick one)
1. **Capture from the running app** — I drive the browser to `localhost:3000` / `:3001`, log in, and screenshot each screen (cleanest, real UI).
2. **You send screenshots** — you take them and drop them in `docs/images/`.
3. **Hybrid** — I capture the main ones; you approve/replace any you want changed.

---

## D. Non-coder guides (in `docs/`, each with screenshots)
| File | Audience | Contents |
|---|---|---|
| `docs/INSTALL-WINDOWS.md` | office admin | download → run Setup → first launch, with pictures |
| `docs/INSTALL-MAC.md` | office admin | download → drag to Applications → open (Gatekeeper note) |
| `docs/ADMIN-GUIDE.md` | admin | create admin, add HR/managers/employees, roles, settings, biometric, reset password |
| `docs/USER-GUIDE.md` | employees | log in, PMT basics, HRMS basics (attendance, leaves) |
| `docs/FAQ.md` | everyone | "app won't open", "forgot password", "teammate can't connect", backup |
| `docs/README.md` | index | links all of the above |

Each guide: short sentences, numbered steps, a screenshot per step, Codespire logo in the header.

---

## E. Enterprise touches (the "MNC feel")
- **Consistent branding** — Codespire logo on README + every doc header.
- **Badges** row under the title.
- **Screenshots in a neat grid** (tables so they align).
- **A "Highlights" strip** — 3–4 icon + one-liner value props (No cloud · One-click install · Your data stays local · Windows & Mac).
- **Clean release notes** — every version lists Added / Fixed / Changed.
- **A short "Why Codespire PMT-HRMS" paragraph** for decision-makers.

---

## F. Releases presentation (what downloaders see)
- Each GitHub Release shows assets: `Codespire PMT-HRMS Setup <ver>.exe` + `Codespire PMT-HRMS <ver>.dmg`.
- README "Download" always links to **`/releases/latest`** (never stale).
- A **release-notes template** so every version reads professionally.

---

## G. Execution order
```
1. Capture screenshots of PMT + HRMS (both dashboards + key screens)
2. Build the visual assets (badges, arrange logo/hero, put images in docs/images/)
3. Write the new enterprise README.md (branding → download → screenshots → features → quick start)
4. Write the non-coder guides in docs/ (with the screenshots)
5. Add the release-notes template + wire the Download links to /releases/latest
6. (with Stage 2) the CI publishes the .exe/.dmg so the Download links go live
```

---

## H. Dependencies / notes
- The **Download links** become live only after **Stage 2** produces the installers in Releases. Until then the README shows a "Coming soon / build in progress" note or links to the releases page.
- Screenshots need the app running (it is) + a quick pass to capture clean shots.
- All copy will be **short, plain-English, non-coder-first** — no jargon.
</content>
