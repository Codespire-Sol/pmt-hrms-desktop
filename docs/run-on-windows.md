# Run PMT + HRMS on Windows

A step-by-step guide for running the app on **one Windows PC** (the "host") that
your team then uses from their browsers. You do **not** need to be technical —
it's mostly double-clicking.

> **Where does it run?** Everything runs on this one PC inside **Docker**.
> Teammates just open a link in their browser — they install nothing. They must
> be on the **same office Wi‑Fi/network**, and this PC must be **switched on**.

---

## What you need (once)

- Windows 10 or 11 (64-bit).
- **Docker Desktop for Windows** (free): https://www.docker.com/products/docker-desktop/
- The app folder (this project), unzipped somewhere like your **Downloads**
  folder.

---

## Step 1 — Install & start Docker Desktop

1. Download and install **Docker Desktop for Windows** from the link above.
2. On install it may enable **WSL 2** (it will guide you) and ask for **one
   restart** — let it finish. This is a one-time thing.
3. Open **Docker Desktop** and wait until the **whale icon 🐳 in the system tray**
   (bottom-right, sometimes under the "▲" arrow) is **steady** and says
   **"Docker Desktop is running."**

> The app cannot start until Docker is running. If you skip this, the launcher
> will tell you and stop safely — just start Docker and try again.

---

## Step 2 — Start the app (first run)

1. Open the app folder, then the **`installer`** folder.
2. **Double-click `Start-PMT-HRMS.bat`.**
   - If Windows SmartScreen shows *"Windows protected your PC"*, click
     **More info → Run anyway** (you only do this once).
3. A window opens and shows progress. **The very first run downloads and builds
   everything — this can take several minutes.** That's normal, not a freeze.
4. When it's done you'll see a green box:

   ```
   ================================================================
     PMT + HRMS is RUNNING
   ================================================================

     Share these links with your team (same office network):
        Project Management (PMT):  http://192.168.1.50:3001
        HR Management (HRMS):      http://192.168.1.50:3000
   ```

5. **On the very first run it also prints your admin password** — **save it now.**

   ```
      FIRST-TIME ADMIN LOGIN
        Email:    admin@local.host
        Password: (a random password shown here)
   ```

> Lost the password later? It's stored in the `.env` file in the app folder, on
> the line `ADMIN_PASSWORD=`.

---

## Step 3 — Log in and set up

1. On this PC, open **http://localhost:3000** (HRMS) in Chrome or Edge.
2. Log in with **`admin@local.host`** and the password from Step 2.
3. **Change the admin password** (top-right profile menu).
4. Open **Credential Settings** (HRMS sidebar) to set your **company name** and,
   optionally, **email (SMTP)**.
5. Add your **people** (HR, managers, employees) and give them roles.

Full first-15-minutes checklist: [../installer/README.md](../installer/README.md).

---

## Step 4 — Let your team in

1. **Open the firewall once:** double-click **`Allow-Team-Access.bat`** and
   approve the Windows prompt. This lets teammates on the network reach the app.
2. Send teammates the two links shown in the green box, e.g.:
   - **PMT:** `http://192.168.1.50:3001`
   - **HRMS:** `http://192.168.1.50:3000`

They open them in **Chrome/Edge** and log in — no install needed.

---

## Step 5 (recommended) — Make it start by itself

So the app comes back automatically whenever the PC restarts — and always uses
the correct network address — turn on auto-start **once**:

- Double-click **`Install-Autostart.bat`**.

Turn it off any time with **`Uninstall-Autostart.bat`**. (If you move the app
folder, run the Install file again.)

---

## Daily use

| Action | How |
|--------|-----|
| **Start** | double-click `Start-PMT-HRMS.bat` |
| **Stop** (data is kept) | double-click `Stop-PMT-HRMS.bat` |
| **Open firewall** (once) | double-click `Allow-Team-Access.bat` |
| Nothing to do if auto-start is on | it starts itself when the PC turns on |

The app keeps running in the background after you close the window.

---

## Troubleshooting

### "This site can't be reached" / it times out for a teammate

Almost always the **host PC's network address (IP) changed** (routers hand out a
new one after a reboot). The link you shared now points at the wrong address.

1. **Easiest fix:** double-click **`Start-PMT-HRMS.bat`** again — it prints the
   **current, correct link**. Share the new link. (With auto-start on, this
   happens by itself.)
2. **Permanent fix:** give the PC a **fixed IP** so the link never changes — on
   your router (usually `http://192.168.1.1`) set a **DHCP Reservation** for this
   PC. Then bookmark the link once and it works forever.
3. Make sure you ran **`Allow-Team-Access.bat`** once so the Windows firewall
   permits incoming connections.

### The teammate can `ping` the PC but the browser still fails

Check the port directly. On the teammate's PC, open **PowerShell** and run
(replace the IP with the host's current one):

```powershell
Test-NetConnection 192.168.1.50 -Port 3001
```

- **`TcpTestSucceeded : True`** → the port is reachable; the problem is the
  browser. Type the address with **`http://`** and use an **InPrivate** window.
- **`TcpTestSucceeded : False`** → the connection is being blocked. Usual causes:
  - The firewall step (`Allow-Team-Access.bat`) wasn't run on the host.
  - Wi‑Fi **"client isolation"** (common on **Guest** networks) blocks devices
    from reaching each other — put both devices on the **main** Wi‑Fi, or ask
    whoever manages the router to turn **AP/Client Isolation off**.
  - A **VPN** or third-party **antivirus/firewall** on the teammate's PC.

> Quick proof it's the network, not the app: connect **both** PCs to a **phone
> hotspot**, run Start again on the host, and open the new link. If it works on
> the hotspot, your normal Wi‑Fi has isolation turned on.

### "Docker is not running"

Open **Docker Desktop**, wait for the steady whale icon, then run
`Start-PMT-HRMS.bat` again.

### Something failed during startup

To see details, open the `installer` folder, then run in a terminal from the app
folder:

```powershell
docker compose -f docker-compose.local.yml logs
```

---

## Notes

- All data (database + uploaded files) stays **on this PC** — nothing goes to the
  cloud.
- **Keep the `.env` file private** — it holds your secrets and admin password.
