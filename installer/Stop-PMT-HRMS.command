#!/usr/bin/env bash
# Double-click this file (macOS) to stop PMT + HRMS. Your data is preserved.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="$(cd "$SCRIPT_DIR/.." && pwd)/docker-compose.local.yml"

# Never let the window vanish on an error without an explanation.
on_error() {
  local exit_code=$?
  echo ""
  printf "\033[31m  Could not stop the app cleanly (exit %s).\033[0m\n" "$exit_code"
  echo "  If Docker Desktop isn't running there is nothing to stop — that's fine."
  echo ""
  read -r -p "Press Enter to close " || true
  exit "$exit_code"
}
trap on_error ERR

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running, so PMT + HRMS is already stopped. Nothing to do."
  echo ""
  read -r -p "Press Enter to close " || true
  exit 0
fi

echo "Stopping PMT + HRMS..."
docker compose -f "$COMPOSE" stop
echo ""
echo "Stopped. All data is kept. Double-click Start-PMT-HRMS.command to start again."
read -r -p "Press Enter to close " || true
