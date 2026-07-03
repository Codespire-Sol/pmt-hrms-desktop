#!/usr/bin/env bash
# ============================================================================
# PMT + HRMS — automatic boot task (macOS / Linux). NOT interactive.
# Run at login by the LaunchAgent that Install-Autostart.command registers.
# On every boot it: waits for Docker, re-detects this machine's current IP,
# updates the team link + CORS in .env, and (re)starts the stack.
#
# This is what makes the app survive an IP change WITHOUT anyone re-running the
# Start launcher — Docker's own auto-resume would otherwise keep the stale IP.
# ============================================================================
set -uo pipefail   # deliberately NOT -e: this runs unattended, so we log and
                   # keep going rather than dying silently.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE="$ROOT/docker-compose.local.yml"
ENV_FILE="$ROOT/.env"
LOG="$SCRIPT_DIR/autostart.log"

# shellcheck source=/dev/null
. "$SCRIPT_DIR/_pmt_common.sh"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG" 2>/dev/null; }

log "----- auto-start invoked -----"

# Nothing to do until someone has run the Start launcher once (which creates .env
# with the secrets + admin password). We never generate secrets here.
if [ ! -f "$ENV_FILE" ]; then
  log "no .env yet — run Start-PMT-HRMS.command once first. Skipping."
  exit 0
fi

# Docker Desktop can take a while to come up after login — wait up to ~5 min.
for _ in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 5
done
if ! docker info >/dev/null 2>&1; then
  log "Docker not ready after waiting — will try again at next login. Skipping."
  exit 0
fi

# Keep the team link + CORS pointed at the current address.
IP="$(pmt_detect_ip || true)"
[ -z "${IP:-}" ] && IP="127.0.0.1"
if pmt_update_env_ip "$ENV_FILE" "$IP"; then
  log "network address changed — updated .env to $IP"
else
  log "network address unchanged ($IP)"
fi

log "bringing the stack up (docker compose up -d)"
if docker compose -f "$COMPOSE" up -d >> "$LOG" 2>&1; then
  log "up. PMT: http://$IP:3001  HRMS: http://$IP:3000"
else
  log "docker compose up failed — see lines above."
fi
