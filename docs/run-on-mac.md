# Run PMT + HRMS on a Mac

A step-by-step guide for running the app on **one Mac** (the "host") that your
team then uses from their browsers. You do **not** need to be technical — it's
mostly double-clicking.

> **Where does it run?** Everything runs on this one Mac inside **Docker**.
> Teammates just open a link in their browser — they install nothing. They must
> be on the **same office Wi‑Fi/network**, and this Mac must be **switched on**.

---

## What you need (once)

- A Mac (Apple Silicon or Intel).
- **Docker Desktop for Mac** (free): https://www.docker.com/products/docker-desktop/
- The app folder (this project), unzipped somewhere like your **Downloads** or
  **Applications** folder.

---

## Step 1 — Install & start Docker Desktop

1. Download and install **Docker Desktop for Mac** from the link above.
2. Open **Docker Desktop** (from Applications).
3. Wait until the **whale icon 🐳 in the top-right menu bar is steady** and, when
   you hover it, says **"Docker Desktop is running."**
   - First launch may ask you to accept terms — that's fine, accept it.
   - You can close the Docker window; it keeps running in the menu bar.

> The app cannot start until Docker is running. If you skip this, the launcher
> will tell you and stop safely — just start Docker and try again.

---

## Step 2 — Start the app (first run)

1. Open the app folder, then the **`installer`** folder.
2. **Double-click `Start-PMT-HRMS.command`.**
   - **First time only**, macOS may block it with *"cannot verify the
     developer."* Fix: **right-click the file → Open → Open**. (You only do this
     once. Alternatively, open Terminal in the folder and run
     `chmod +x Start-PMT-HRMS.command`.)
3. A Terminal window opens and shows progress. **The very first run downloads and
   builds everything — this can take several minutes.** That's normal, not a
   freeze.
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

1. On this Mac, open **http://localhost:3000** (HRMS) in Chrome or Safari.
2. Log in with **`admin@local.host`** and the password from Step 2.
3. **Change the admin password** (top-right profile menu).
4. Open **Credential Settings** (HRMS sidebar) to set your **company name** and,
   optionally, **email (SMTP)**.
5. Add your **people** (HR, managers, employees) and give them roles.

Full first-15-minutes checklist: [../installer/README.md](../installer/README.md).

---

## Step 4 — Let your team in

Send teammates the two links shown in the green box, e.g.:

- **PMT:** `http://192.168.1.50:3001`
- **HRMS:** `http://192.168.1.50:3000`

They open them in **Chrome/Edge/Safari** and log in — no install needed.

> On macOS you usually **don't** need to touch the firewall — Docker's ports are
> reachable on the LAN by default. If macOS's firewall is on, allow the incoming
> connection when prompted.

---

## Step 5 (recommended) — Make it start by itself

So the app comes back automatically whenever the Mac restarts — and always uses
the correct network address — turn on auto-start **once**:

- Double-click **`Install-Autostart.command`**.

Turn it off any time with **`Uninstall-Autostart.command`**. (If you move the app
folder, run the Install file again.)

---

## Daily use

| Action | How |
|--------|-----|
| **Start** | double-click `Start-PMT-HRMS.command` |
| **Stop** (data is kept) | double-click `Stop-PMT-HRMS.command` |
| Nothing to do if auto-start is on | it starts itself when the Mac turns on |

The app keeps running in the background after you close the Terminal window.

---

## Troubleshooting

### "This site can't be reached" / it times out for a teammate

Almost always the **host Mac's network address (IP) changed** (routers hand out a
new one after a reboot). The link you shared now points at the wrong address.

1. **Easiest fix:** double-click **`Start-PMT-HRMS.command`** again — it prints
   the **current, correct link**. Share the new link. (With auto-start on, this
   happens by itself.)
2. **Permanent fix:** give the Mac a **fixed IP** so the link never changes — on
   your router (usually `http://192.168.1.1`) set a **DHCP Reservation** for this
   Mac. Then bookmark the link once and it works forever.
3. The launcher also prints a **name link** like `http://your-mac.local:3001`,
   which often keeps working even when the IP changes — try it as a backup.

### The teammate can `ping` the Mac but the browser still fails

- Make sure they type the address with **`http://`** (not `https://`) and try an
  **Incognito/Private** window.
- Some Wi‑Fi (especially **Guest** networks) has **"client isolation"** that
  blocks devices from reaching each other. Put **both** devices on the **main**
  Wi‑Fi, or ask whoever manages the router to turn **AP/Client Isolation off**.
- Quick proof: connect **both** the Mac and the other device to a **phone
  hotspot**, run Start again on the Mac, and open the new link. If it works on the
  hotspot, your normal Wi‑Fi has isolation turned on.

### "Docker is not running"

Open **Docker Desktop**, wait for the steady whale icon, then run
`Start-PMT-HRMS.command` again.

### Something failed during startup

The launcher prints the error and pauses (it won't just vanish). To see details:

```bash
docker compose -f docker-compose.local.yml logs
```

---

## Notes

- All data (database + uploaded files) stays **on this Mac** — nothing goes to
  the cloud.
- **Keep the `.env` file private** — it holds your secrets and admin password.
- The `.bat` files in the `installer` folder are **Windows-only** and are ignored
  on a Mac.
