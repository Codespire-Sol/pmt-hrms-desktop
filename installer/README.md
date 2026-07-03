# PMT + HRMS — Install & Run (for the office PC)

Run this on **one PC in the office** (the "host"). Everyone else on the same
network uses it from their web browser — they install nothing.

## One-time setup

1. **Install Docker Desktop** (free): https://www.docker.com/products/docker-desktop/
2. **Start Docker Desktop and wait until it's running** (see the next section).
3. Start the app:
   - **Windows:** double-click **`Start-PMT-HRMS.bat`**
   - **Mac:** double-click **`Start-PMT-HRMS.command`** (see "On a Mac" below)

That's it. The first run downloads and builds everything (a few minutes) and then
shows something like:

```
  PMT + HRMS is RUNNING
  Share these links with your team (same office network):
     Project Management (PMT):  http://192.168.1.50:3001
     HR Management (HRMS):      http://192.168.1.50:3000
```

It also prints your **admin email + password** on the very first run — save it and
change the password after logging in.

---

## Step 1 in detail: getting Docker Desktop running

Docker Desktop is the engine that runs the app. You start it **once**; after that
it runs quietly in the background.

- **First launch:** it may ask you to accept terms, and on Windows it may need
  **WSL 2** (it will offer to install/update it) and possibly **one restart**.
  Let it finish — this is a one-time thing.
- **How to know it's ready:** look at the **whale icon 🐳** in the system tray
  (bottom-right of the taskbar, sometimes hidden under the small "▲" arrow). When
  Docker is starting the whale **animates**; when it's ready the whale is
  **steady** and hovering it says *"Docker Desktop is running."*
- **You do NOT need to keep the Docker window open** — you can close it; the engine
  keeps running in the tray. (See it as "on" = whale in the tray.)
- **If it's stuck** on "Docker Desktop starting…" for several minutes, or says
  "WSL update required": follow its prompt, or quit and reopen Docker Desktop, or
  restart the PC once. `Start-PMT-HRMS.bat` will also warn you and stop safely if
  Docker isn't running yet — just start Docker, then run it again.

---

## On a Mac (or Linux)

The app is the same (it runs in Docker); only the launcher differs.

1. Install **Docker Desktop for Mac** and start it — the whale icon appears in the
   **menu bar** (top-right). Wait until it's steady.
2. Double-click **`Start-PMT-HRMS.command`** (instead of the `.bat`). Finder opens
   it in Terminal and it does the same thing: generates `.env`, detects your LAN
   IP, builds, and prints the team links.
   - **First time only**, macOS may block it ("unidentified developer") or it may
     not be executable. Fix either way: **right-click the file → Open** the first
     time, or run once in Terminal: `chmod +x Start-PMT-HRMS.command`.
3. **Stop** with **`Stop-PMT-HRMS.command`**.

No firewall script is needed on macOS — Docker's published ports are reachable on
the LAN by default. (If you have macOS's firewall turned on, allow incoming
connections when prompted, or add Docker under **System Settings → Network →
Firewall → Options**.)

The `.bat` / `Allow-Team-Access.bat` files are Windows-only and are simply ignored
on a Mac.

---

## Admin: set up your team (your first 15 minutes)

After the app is running, do this once, in order:

1. **Log in.** Open the **HRMS** link (`:3000`) on the host PC (or
   `http://localhost:3000`). Use `admin@local.host` and the password the installer
   printed. *(Lost it? It's saved in the `.env` file in the app folder, line
   `ADMIN_PASSWORD=`.)*
2. **Change the admin password** (top-right profile → change password).
3. **Open Credential Settings** (HRMS sidebar → *Credential Settings*):
   - **Company** tab — set your company name (used on emails, offer letters, PDFs).
   - **Email** tab — set your SMTP details if you want the app to send emails
     (onboarding invites, etc.), then use **Send test** to confirm.
   - *Not on this page:* the **OpenAI key** (AI features) and **attendance rules**
     are set in the `.env` file instead — see "Configuration" below.
4. **Add your people and give them roles.** Add HR, managers, and employees from
   inside the app; their role controls what they can see and do.
5. **Share the links.** Send teammates the **PMT** (`:3001`) and **HRMS** (`:3000`)
   links shown when the app started.
6. **Open the firewall (once):** double-click **`Allow-Team-Access.bat`** and
   approve the Windows prompt, so teammates on the network can connect.

---

## Daily use

- **Start:** double-click `Start-PMT-HRMS.bat` (Windows) / `Start-PMT-HRMS.command` (Mac)
- **Stop:**  double-click `Stop-PMT-HRMS.bat` (Windows) / `Stop-PMT-HRMS.command` (Mac) — data is always kept
- The app keeps running in the background after you close the window.

## Your team

Send teammates the **PMT** and **HRMS** links. They open them in Chrome/Edge and
log in — no install needed. They must be on the **same office network** (Wi-Fi/LAN)
as this PC, and this PC must be **switched on**.

## Keep the app starting by itself (recommended)

By default you start the app by double-clicking `Start-PMT-HRMS`. If you'd rather
have it **start automatically whenever the host PC turns on**, turn on auto-start
once:

- **Windows:** double-click **`Install-Autostart.bat`**
- **Mac:** double-click **`Install-Autostart.command`**

From then on, every time the PC starts the app comes back on its own — and it
**re-checks the network address each time**, so the team link keeps working even
if the PC's IP changed overnight. Turn it off any time with
`Uninstall-Autostart.bat` / `Uninstall-Autostart.command`. (If you move the app
folder, run the Install file again.)

## If the team link stops working ("can't be reached" / times out)

Almost always this means the **host PC's network address (IP) changed** — routers
hand out a new one after a reboot or power cut. The fix:

1. **Easiest:** double-click **`Start-PMT-HRMS`** again — it prints the current,
   correct link. Share the new link with your team. (With auto-start on, this
   happens by itself at every startup.)
2. **Best permanent fix — give the host PC a fixed IP** so the link *never*
   changes: on your router's admin page (usually `http://192.168.1.1`), find
   **DHCP Reservation** / **Static Lease** and reserve an address for this PC.
   Then bookmark the link once and it works forever.
3. **Also printed at startup:** a name-based link like
   `http://your-computer.local:3001`. This often keeps working across IP changes
   without any setup — try it if the number link breaks (it isn't supported on
   every network, so treat it as a backup).

> First check the basics: teammates must be on the **same Wi-Fi/network** (not a
> **Guest** network), and the host PC must be **on**. Some guest/office Wi-Fi
> blocks devices from reaching each other ("client isolation") — use the main
> network, or ask whoever manages the router to disable it.

## Configuration

- Configuration lives in **`.env`** (auto-generated in the app folder). The
  installer fills it with secure random secrets and this PC's network address.
- **Company name & SMTP email:** set in the in-app Credential Settings page (above).
- **OpenAI API key** (AI features): add `OPENAI_API_KEY=...` to `.env`.
- **Attendance rules:** edit `FULL_DAY_HOURS`, `HALF_DAY_HOURS`,
  `OFFICE_START_TIME`, `COMPANY_TIMEZONE` in `.env`.
- **Any `.env` change takes effect after you Stop, then Start the app again.**
- **Biometric devices:** see [../docs/biometric-attendance.md](../docs/biometric-attendance.md).

## Notes

- All data (database + uploaded files) stays **on this PC** — nothing goes to the
  cloud.
- **Keep `.env` private and never share it** — it holds all your secrets.
- To back up: copy the Docker volumes (`pmt-hrms-local_pg_data` and
  `pmt-hrms-local_api_uploads`).
