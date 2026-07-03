#!/usr/bin/env bash
# ============================================================================
# PMT + HRMS — one-click local launcher (macOS / Linux).
# On a Mac: double-click this file (Finder opens it in Terminal). It will:
#   1. check Docker is installed & running
#   2. generate a .env with strong random secrets + this machine's LAN IP (first run)
#   3. build & start the whole stack
#   4. print the link to share with your team
# (First time on macOS you may need to right-click -> Open, or run: chmod +x this file)
# ============================================================================
set -euo pipefail

# Resolve the repo root (parent of installer/), even when double-clicked from Finder.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE="$ROOT/docker-compose.local.yml"
ENV_FILE="$ROOT/.env"
TMP_ENV=""   # set later; referenced by the error handler for cleanup

# Shared IP-detection / config-update helpers (same code the boot task uses).
# shellcheck source=/dev/null
. "$SCRIPT_DIR/_pmt_common.sh"

cyan()  { printf "\n\033[36m==> %s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$1"; }

# --- Error handling --------------------------------------------------------
# Without this, ANY failure under `set -e` would close the window instantly and
# a non-technical user would see nothing. Instead we catch it, explain, and wait.
on_error() {
  local exit_code=$?
  local line=${1:-?}
  rm -f "${TMP_ENV:-}" 2>/dev/null || true   # never leave a half-written .env
  echo ""
  red   "  Something went wrong while starting PMT + HRMS (exit $exit_code)."
  echo  ""
  yellow "  Try this:"
  echo  "    1. Make sure Docker Desktop is running (steady whale icon, top-right menu bar)."
  echo  "    2. Run this launcher again — the very first build sometimes needs a retry."
  echo  "    3. If it still fails, view the logs with:"
  echo  "         docker compose -f \"$COMPOSE\" logs"
  echo  ""
  echo  "  (For support: failed near line $line of the launcher.)"
  echo  ""
  read -r -p "Press Enter to close " || true
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

# --- 1. Docker check -------------------------------------------------------
cyan "Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo ""
  red "  Docker is not installed."
  echo ""
  yellow "  Please install Docker Desktop, then run Start-PMT-HRMS again:"
  echo "    https://www.docker.com/products/docker-desktop/"
  echo ""
  read -r -p "Press Enter to close " || true
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo ""
  red "  Docker is installed but NOT running."
  echo ""
  yellow "  Please:"
  echo "    1. Open Docker Desktop (Applications on macOS)."
  echo "    2. Wait until the whale icon in the menu bar is steady (not animating)."
  echo "    3. Then run Start-PMT-HRMS again."
  echo ""
  read -r -p "Press Enter to close " || true
  exit 1
fi
green "Docker OK."

# --- 2. Detect this machine's LAN IP --------------------------------------
LAN_IP="$(pmt_detect_ip || true)"
[ -z "${LAN_IP:-}" ] && LAN_IP="127.0.0.1"
echo "This machine's address on the office network: $LAN_IP"

# --- 2b. Warn early if the ports we need are already taken -----------------
# Only meaningful on a fresh start; if our own stack is already up it holds these
# ports itself, so skip the check in that case to avoid a false alarm.
check_ports() {
  local busy=""
  for p in 3000 3001 4000; do
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then busy="$busy $p"; fi
  done
  if [ -n "$busy" ]; then
    echo ""
    yellow "  Note: these needed ports look busy:$busy"
    echo   "  PMT/HRMS use ports 3000, 3001 and 4000. Another program may be using them."
    echo   "  If the app fails to start, quit that program and run this launcher again."
  fi
}
if [ -z "$(docker compose -f "$COMPOSE" ps -q 2>/dev/null || true)" ]; then
  check_ports
fi

# --- 3. Generate .env on first run ----------------------------------------
# Robust under `set -o pipefail`: when `head` has read enough it closes the pipe,
# so `tr` receives SIGPIPE and "fails" — that is expected, so we swallow it with
# `|| true`. Without this the launcher would abort here before writing .env.
gen_secret() {
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c "$1" || true
}

if [ ! -f "$ENV_FILE" ]; then
  cyan "First run — generating configuration (.env) with secure secrets..."

  # Generate everything first, then verify, then write — so we never leave a
  # partially written config behind if something goes wrong.
  ADMIN_PASS="$(gen_secret 12)"
  JWT_S="$(gen_secret 48)"
  JWT_R="$(gen_secret 48)"
  DB_PASS="$(gen_secret 24)"
  if [ -z "$ADMIN_PASS" ] || [ -z "$JWT_S" ] || [ -z "$JWT_R" ] || [ -z "$DB_PASS" ]; then
    red "  Could not generate secure secrets."
    exit 1
  fi

  # Atomic write: build the file under a temp name, then move it into place.
  TMP_ENV="$ENV_FILE.tmp.$$"
  cat > "$TMP_ENV" <<EOF
# Auto-generated by the installer. Keep this file private.
NODE_ENV=production
LOG_LEVEL=info

# Default administrator (change the password after first login)
ADMIN_EMAIL=admin@local.host
ADMIN_PASSWORD=$ADMIN_PASS

# Secrets
JWT_SECRET=$JWT_S
JWT_REFRESH_SECRET=$JWT_R
DATABASE_PASSWORD=$DB_PASS
DATABASE_NAME=projectflow
DATABASE_USER=postgres

# LAN access (team members reach the app at these addresses)
PUBLIC_HOST=$LAN_IP
FRONTEND_URL=http://$LAN_IP:3001
HRMS_FRONTEND_URL=http://$LAN_IP:3000
CORS_ORIGINS=http://$LAN_IP:3000,http://$LAN_IP:3001,http://localhost:3000,http://localhost:3001

# Attendance rules (edit these then restart to apply)
COMPANY_TIMEZONE=Asia/Kolkata
FULL_DAY_HOURS=9
HALF_DAY_HOURS=4
OFFICE_START_TIME=09:30

# Optional integrations (leave blank = feature off)
OPENAI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
EOF
  mv "$TMP_ENV" "$ENV_FILE"
  TMP_ENV=""
  green "Configuration created."
  echo ""
  yellow "  ----------------------------------------------------------------"
  yellow "   FIRST-TIME ADMIN LOGIN"
  yellow "     Email:    admin@local.host"
  yellow "     Password: $ADMIN_PASS"
  yellow "   (Save this. Change the password after logging in.)"
  yellow "  ----------------------------------------------------------------"
else
  echo "Using existing configuration (.env)."
  # The host's IP can change (new DHCP lease after a reboot/router restart). Keep
  # the team link + CORS pointed at the CURRENT address on every launch.
  if pmt_update_env_ip "$ENV_FILE" "$LAN_IP"; then
    green "Network address changed — team link updated to: $LAN_IP"
  fi
fi

# --- 4. Build & start ------------------------------------------------------
cyan "Starting PMT + HRMS (first run downloads/builds — this can take several minutes)..."
docker compose -f "$COMPOSE" up -d --build

# --- 5. Wait for the API to be healthy ------------------------------------
cyan "Waiting for the application to be ready..."
READY=false
for _ in $(seq 1 60); do
  if docker compose -f "$COMPOSE" ps --format '{{.Service}} {{.Status}}' 2>/dev/null | grep -E '^api ' | grep -q 'healthy'; then
    READY=true; break
  fi
  sleep 5
done

echo ""
if [ "$READY" = true ]; then
  green "================================================================"
  green "  PMT + HRMS is RUNNING"
  green "================================================================"
  echo ""
  echo "  Share these links with your team (same office network):"
  printf "     Project Management (PMT):  http://%s:3001\n" "$LAN_IP"
  printf "     HR Management (HRMS):      http://%s:3000\n" "$LAN_IP"
  LOCAL_NAME="$(pmt_local_name || true)"
  if [ -n "${LOCAL_NAME:-}" ]; then
    echo ""
    echo "  Tip: this name usually keeps working even if the IP changes:"
    printf "     PMT:  http://%s:3001     HRMS: http://%s:3000\n" "$LOCAL_NAME" "$LOCAL_NAME"
  fi
  echo ""
  echo "  On this machine you can also use http://localhost:3001 / :3000"
else
  yellow "The app is taking longer than expected to start."
  echo "Check status with:  docker compose -f docker-compose.local.yml ps"
  echo "View logs with:     docker compose -f docker-compose.local.yml logs -f api"
fi
echo ""
read -r -p "Press Enter to close this window (the app keeps running in the background) " || true
