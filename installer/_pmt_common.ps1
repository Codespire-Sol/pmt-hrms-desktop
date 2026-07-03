# ============================================================================
# Shared helpers for the PMT + HRMS launchers (Windows). Dot-sourced by
# start.ps1 and auto-start.ps1 so the interactive launcher and the automatic
# logon task use exactly the same IP detection + config-update code.
# ============================================================================

function Get-LanIp {
  $ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1).IPv4Address.IPAddress
  if (-not $ip) { $ip = '127.0.0.1' }
  return $ip
}

# Rewrite the IP-dependent lines of an existing .env to $Ip.
# Returns $true only if the IP actually changed (so callers can log it).
function Update-EnvIp {
  param([string]$EnvFile, [string]$Ip)
  if (-not (Test-Path $EnvFile)) { return $false }
  if (-not $Ip) { return $false }
  $lines = Get-Content -Path $EnvFile
  $current = ($lines | Where-Object { $_ -match '^PUBLIC_HOST=' } | Select-Object -First 1) -replace '^PUBLIC_HOST=', ''
  if ($current -eq $Ip) { return $false }
  $out = foreach ($l in $lines) {
    if     ($l -match '^PUBLIC_HOST=')       { "PUBLIC_HOST=$Ip" }
    elseif ($l -match '^FRONTEND_URL=')      { "FRONTEND_URL=http://${Ip}:3001" }
    elseif ($l -match '^HRMS_FRONTEND_URL=') { "HRMS_FRONTEND_URL=http://${Ip}:3000" }
    elseif ($l -match '^CORS_ORIGINS=')      { "CORS_ORIGINS=http://${Ip}:3000,http://${Ip}:3001,http://localhost:3000,http://localhost:3001" }
    else   { $l }
  }
  Set-Content -Path $EnvFile -Value $out -Encoding UTF8
  return $true
}
