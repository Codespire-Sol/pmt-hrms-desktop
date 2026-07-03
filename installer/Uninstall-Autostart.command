#!/usr/bin/env bash
# ============================================================================
# PMT + HRMS — turn OFF automatic start (macOS). Double-click once.
# Removes the LaunchAgent. The app itself is NOT stopped and your data is kept;
# you can still start it any time with Start-PMT-HRMS.command.
# ============================================================================
set -uo pipefail

LABEL="com.codespire.pmt-hrms"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Automatic start is OFF."
else
  echo "Automatic start was not enabled — nothing to remove."
fi
echo "You can still start the app with Start-PMT-HRMS.command."
echo ""
read -r -p "Press Enter to close " || true
