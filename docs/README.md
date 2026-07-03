![Codespire](images/codespire-logo.png)

# Codespire PMT-HRMS — Documentation

Welcome. **Codespire PMT-HRMS** is a downloadable desktop app for Windows and Mac
that runs **Project Management (PMT)** and **HR Management (HRMS)** together on one
office PC. You install it on a single "host" PC; everyone else on the same office
network opens it in their web browser — they install nothing.

- **PMT (Project Management):** `http://<host-ip>:3001`
- **HRMS (HR Management):** `http://<host-ip>:3000`

Login is a local email and password. Your data stays on the host PC — nothing goes
to the cloud.

---

## The guides

| Guide | Who it's for | What it covers |
|-------|--------------|----------------|
| [INSTALL-WINDOWS.md](INSTALL-WINDOWS.md) | The person setting up the host PC (Windows) | Download the installer, run Setup, first launch, create your admin account, open PMT/HRMS |
| [INSTALL-MAC.md](INSTALL-MAC.md) | The person setting up the host PC (Mac) | Download the `.dmg`, drag to Applications, first open, create your admin account |
| [ADMIN-GUIDE.md](ADMIN-GUIDE.md) | The admin / office manager | Your first 30 minutes: settings, adding people & roles, email, attendance devices, resetting the admin password, sharing links, backups |
| [USER-GUIDE.md](USER-GUIDE.md) | Every team member (employees) | Open the link, log in, use PMT (boards, issues, time) and HRMS (attendance, leaves) |
| [FAQ.md](FAQ.md) | Everyone | Common questions: app won't open, forgot the password, teammates can't connect, where's my data, is it safe on shutdown |
| [biometric-attendance.md](biometric-attendance.md) | Whoever configures the biometric device | Connecting a fingerprint / face attendance machine so punches become check-ins automatically |

---

## Quick links

- **Download the app:** see the **Download** section in the [project README](../README.md).
- **Set up the host PC:** [Windows guide](INSTALL-WINDOWS.md) · [Mac guide](INSTALL-MAC.md)
- **Support:** contact your Codespire representative, or open an issue on the
  project's repository.
- **License:** [Elastic License 2.0](../LICENSE).

---

## At a glance (on the host PC)

| App | Address on the host | Address for the team |
|-----|---------------------|----------------------|
| PMT (Project Management) | `http://localhost:3001` | `http://<host-ip>:3001` |
| HRMS (HR Management) | `http://localhost:3000` | `http://<host-ip>:3000` |

> The `<host-ip>` is the host PC's address on your office network (for example
> `192.168.1.50`). The app shows you the exact link to share on its launcher
> screen and in the tray menu.
