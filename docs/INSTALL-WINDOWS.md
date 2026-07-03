![Codespire](images/codespire-logo.png)

# Install Codespire PMT-HRMS on Windows

This guide walks you through installing the app on **one Windows PC** — the "host".
You do **not** need to be technical. It's mostly clicking **Next** and then creating
your admin account.

> **What runs where?** The app runs on this one PC. Your teammates just open a link
> in their browser — they install nothing. They must be on the **same office
> Wi-Fi/network**, and this PC must be **switched on**.

---

## Before you start

- A Windows 10 or 11 PC (64-bit) that will stay on during office hours.
- About 5 minutes.

You do **not** need Docker or any other software. Everything is inside the installer.

---

## Step 1 — Download the installer

1. Open the **Download** section of the project page and download the Windows
   installer. It is a single file that ends in **`.exe`** (for example
   `Codespire-PMT-HRMS-Setup.exe`).
2. It usually lands in your **Downloads** folder.

![The Codespire launcher](images/app-launcher.png)

---

## Step 2 — Run Setup

1. **Double-click the `.exe`** you just downloaded.
2. Windows may show a blue **"Windows protected your PC"** (SmartScreen) box. This
   is normal for a newly published app. Click **More info**, then **Run anyway**.
   You only do this once.
3. Follow the Setup screens (**Next → Install**). When it finishes, the app opens
   by itself, and a **Codespire icon** is added to your Start menu and desktop.

> If you don't see **Run anyway**, click the small **More info** link first — the
> button appears after that.

---

## Step 3 — First launch

1. The very first launch takes a little longer while the app sets itself up in the
   background. That's normal — wait for the window to appear.
2. Because this is the first time, the app shows the **Create your admin account**
   screen. (On later launches it goes straight to the app.)

![Create your admin account](images/app-setup.png)

---

## Step 4 — Create your admin account

The **admin** is the main account that manages the whole system. You choose the
email and password now — there is no default password to look up.

1. Enter an **Email** (for example `admin@yourcompany.com`).
2. Choose a **Password** — at least **8 characters**. Pick something strong and
   write it down somewhere safe.
3. Re-enter it in **Confirm password**.
4. Click **Create admin account**.

The app confirms and opens the **launcher** — the screen where you choose **Open
PMT** or **Open HRMS**.

> This account is stored **only on this PC**. Keep the password safe. If you ever
> forget it, you can reset it from the app itself — see
> [ADMIN-GUIDE.md](ADMIN-GUIDE.md) → "Reset the admin password".

---

## Step 5 — Open PMT and HRMS

1. On the launcher screen, click **Open PMT** (Project Management) or **Open HRMS**
   (HR Management). The app opens that tool in the same window.
2. You can switch any time from the **Apps** menu at the top, or from the Codespire
   **tray icon** near the clock.

![PMT dashboard](images/pmt-dashboard.png)

![HRMS dashboard](images/hrms-dashboard.png)

---

## Step 6 — Let your team in

Your teammates open the app in their browser using a link the app gives you.

1. On the launcher screen, look under **"Share on your network"** — it shows your
   team links, for example:
   - **PMT:** `http://192.168.1.50:3001`
   - **HRMS:** `http://192.168.1.50:3000`
2. The first time, Windows may ask to allow the app through the firewall. Click
   **Allow access** so teammates on the network can connect.
3. Send those two links to your team. They open them in **Chrome or Edge** and log
   in with the accounts you create for them.

Full details on adding people, email, and attendance devices are in the
[Admin Guide](ADMIN-GUIDE.md).

---

## Daily use

| Action | How |
|--------|-----|
| **Start the app** | Open **Codespire PMT-HRMS** from the Start menu or desktop |
| **Keep it running** | Just close the window — it keeps running in the **tray** (near the clock) |
| **Fully stop it** | Right-click the tray icon → **Quit** |

The host PC must stay **on** for teammates to use the app.

---

## If something goes wrong

- **The `.exe` won't run / SmartScreen blocks it:** click **More info → Run
  anyway** (Step 2).
- **A teammate can't connect:** check they're on the **same Wi-Fi**, that the host
  PC is **on**, and that you allowed the firewall prompt. See the [FAQ](FAQ.md).
- **Forgot the admin password:** reset it from the tray/Help menu — see the
  [Admin Guide](ADMIN-GUIDE.md).

More answers: [FAQ.md](FAQ.md).
