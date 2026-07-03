#!/usr/bin/env bash
# ============================================================================
# PMT + HRMS — turn ON automatic start (macOS). Double-click ONCE.
# Registers a LaunchAgent so that every time you log in, the app starts by
# itself and always uses this Mac's CURRENT network address — so the team link
# keeps working even after the IP changes. Undo any time with
# Uninstall-Autostart.command.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTO="$SCRIPT_DIR/Auto-Start.sh"
LABEL="com.codespire.pmt-hrms"
AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST="$AGENTS_DIR/$LABEL.plist"

on_error() {
  echo ""
  printf "\033[31m  Could not turn on automatic start.\033[0m\n"
  echo "  You can still run the app any time by double-clicking Start-PMT-HRMS.command."
  echo ""
  read -r -p "Press Enter to close " || true
  exit 1
}
trap on_error ERR

chmod +x "$AUTO" 2>/dev/null || true
mkdir -p "$AGENTS_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$AUTO</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$SCRIPT_DIR/autostart.out.log</string>
    <key>StandardErrorPath</key>
    <string>$SCRIPT_DIR/autostart.err.log</string>
</dict>
</plist>
EOF

# (Re)load it. `unload` first makes this safe to run more than once.
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
printf "\033[32m  Automatic start is ON.\033[0m\n"
echo ""
echo "  From now on, when you log in to this Mac the app starts by itself and"
echo "  always shows the correct link for today's network address."
echo ""
echo "  (It just ran once now too. To turn this off, double-click"
echo "   Uninstall-Autostart.command. If you MOVE this folder, run this again.)"
echo ""
read -r -p "Press Enter to close " || true
