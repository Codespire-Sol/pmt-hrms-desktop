#!/usr/bin/env bash
# ============================================================================
# Shared helpers for the PMT + HRMS launchers (macOS / Linux).
# This file is SOURCED by the other scripts — it is not meant to be run directly.
# Keeping the IP logic here means the interactive launcher and the automatic
# boot task use exactly the same detection + config-update code.
# ============================================================================

# Detect this machine's LAN IP (the address teammates use to reach the app).
pmt_detect_ip() {
  if [ "$(uname)" = "Darwin" ]; then
    local iface ip
    iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
    if [ -n "${iface:-}" ]; then ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"; fi
    if [ -z "${ip:-}" ]; then
      for i in en0 en1 en2 en3; do
        ip="$(ipconfig getifaddr "$i" 2>/dev/null || true)"
        [ -n "$ip" ] && break
      done
    fi
    echo "${ip:-}"
  else
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

# This machine's stable ".local" name (survives IP changes when mDNS works).
pmt_local_name() {
  local n
  n="$(scutil --get LocalHostName 2>/dev/null || true)"
  [ -n "$n" ] && echo "${n}.local"
}

# Rewrite the IP-dependent lines of an existing .env to a new IP.
#   Usage:  pmt_update_env_ip <env_file> <ip>
#   Returns 0 (and rewrites) only if the IP actually changed; 1 otherwise.
# The rewrite is atomic (temp file -> mv) so a crash can't corrupt .env, and it
# touches ONLY the four network lines — secrets and everything else are untouched.
pmt_update_env_ip() {
  local env_file="$1" ip="$2" current tmp
  [ -f "$env_file" ] || return 1
  [ -n "$ip" ] || return 1
  current="$(awk -F= '/^PUBLIC_HOST=/{print $2; exit}' "$env_file")"
  [ "$current" = "$ip" ] && return 1   # already correct — nothing to do
  tmp="$env_file.tmp.$$"
  awk -v ip="$ip" '
    /^PUBLIC_HOST=/       { print "PUBLIC_HOST=" ip; next }
    /^FRONTEND_URL=/      { print "FRONTEND_URL=http://" ip ":3001"; next }
    /^HRMS_FRONTEND_URL=/ { print "HRMS_FRONTEND_URL=http://" ip ":3000"; next }
    /^CORS_ORIGINS=/      { print "CORS_ORIGINS=http://" ip ":3000,http://" ip ":3001,http://localhost:3000,http://localhost:3001"; next }
    { print }
  ' "$env_file" > "$tmp" && mv "$tmp" "$env_file"
}
