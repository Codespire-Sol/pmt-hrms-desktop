![Codespire](images/codespire-logo.png)

# Frequently Asked Questions

Plain-English answers to the questions people ask most. If you're the admin, also
see the [Admin Guide](ADMIN-GUIDE.md); if you're a team member, see the
[User Guide](USER-GUIDE.md).

---

## The app won't open

Try these, in order:

1. **Give it a moment.** The very first launch takes longer while the app sets
   itself up. Wait for the window to appear.
2. **Check the tray / menu bar.** Closing the window doesn't quit the app — it
   keeps running. Look for the **Codespire icon** in the Windows **tray** (near the
   clock) or the Mac **menu bar** (top-right) and click it to bring the window back.
3. **Windows blocked it (SmartScreen).** On a fresh install, click **More info →
   Run anyway**. See [INSTALL-WINDOWS.md](INSTALL-WINDOWS.md).
4. **Mac blocked it (Gatekeeper).** Use **right-click → Open** the first time. See
   [INSTALL-MAC.md](INSTALL-MAC.md).
5. **Restart the app.** Quit it fully (tray / menu-bar icon → **Quit**), then open
   it again.

---

## I forgot the admin password

No problem — you reset it **from the app on the host PC**. No email or code is
needed, and **all your data is kept**.

1. On the host PC, click the Codespire **tray icon** (Windows) or **menu-bar icon**
   (Mac). You can also use the **Help** menu at the top of the app window.
2. Choose **Reset admin password…**.
3. Enter a new password (or click **Generate strong password**) and confirm it.
4. Click **Reset password**. The new password works immediately.

> This only works **on the host PC**, so no one outside the office can reset it.
> That's a safety feature. Details: [Admin Guide](ADMIN-GUIDE.md) → "Reset the
> admin password".

---

## A teammate gets a timeout / "site can't be reached"

The app runs on the host PC and teammates connect to it over the office network.
Check these three things:

1. **Same network.** The teammate must be on the **same office Wi-Fi/LAN** as the
   host PC — not a **Guest** network. Some guest networks block devices from
   reaching each other.
2. **Firewall allowed.** On the host PC, the app must be **allowed through the
   firewall**. On Windows, click **Allow access** when prompted; on Mac, allow
   incoming connections. See the [Admin Guide](ADMIN-GUIDE.md) → "Share the links".
3. **Host PC is on.** The host PC must be **switched on and awake**, with the app
   running (it's fine if only the tray/menu-bar icon is showing).

> **Link stopped working after a reboot?** The host PC's network address (IP) can
> change when the router restarts. Ask the admin for the **current link** — the app
> shows it on the launcher screen and in the tray/menu-bar menu. For a permanent
> fix, give the host PC a fixed IP on the router (DHCP reservation).

---

## Where is my data, and how do I back it up?

Everything — projects, employees, attendance, settings, and uploaded files — lives
in **one folder on the host PC**:

| System | Data folder |
|--------|-------------|
| Windows | `C:\Users\<you>\AppData\Roaming\codespire-pmt-hrms\data` |
| Mac | `~/Library/Application Support/codespire-pmt-hrms/data` |

**To back up:**

1. **Quit the app fully** (tray / menu-bar icon → **Quit**) so nothing is being
   written.
2. **Copy the whole `data` folder** to a USB drive, another PC, or cloud storage.
3. Start the app again.

> On Windows, `AppData` is hidden — paste the path into the File Explorer address
> bar, or turn on **View → Show → Hidden items**. Your data stays on this PC;
> nothing goes to the cloud unless you copy it there.

---

## Does closing the window stop the app?

**No.** Closing the window just hides it — the app keeps running so your team can
still use it. You'll see the **Codespire icon** in the tray (Windows) or menu bar
(Mac).

To **fully stop** the app, click that icon and choose **Quit**. (While it's fully
stopped, teammates can't connect until you open it again.)

---

## Is my data safe when I shut down or quit?

**Yes.** Your data is saved on the host PC's disk and **persists across restarts**.
Quitting the app or restarting the PC does not lose anything — when you open the app
again, everything is exactly where you left it.

For extra safety, keep a periodic **backup** of the `data` folder (see above).

---

## Do teammates need to install anything?

**No.** Only the host PC has the app installed. Everyone else just opens the **PMT**
and **HRMS** links in **Chrome, Edge, or Safari** and logs in.

---

## How do teammates log in?

The **admin** creates an account for each person (in HRMS → Employees) and shares
the login email and password. See the [User Guide](USER-GUIDE.md).

---

## Still stuck?

- Setup: [Windows](INSTALL-WINDOWS.md) · [Mac](INSTALL-MAC.md)
- Admin tasks: [Admin Guide](ADMIN-GUIDE.md)
- Everyday use: [User Guide](USER-GUIDE.md)
- Attendance devices: [biometric-attendance.md](biometric-attendance.md)
- License: [Elastic License 2.0](../LICENSE)
