# ============================================================================
# PMT + HRMS - automatic logon task (Windows). NOT interactive.
# Run at logon by the scheduled task that Install-Autostart.bat registers.
# On every logon it: waits for Docker, re-detects this PC's current IP, updates
# the team link + CORS in .env, and (re)starts the stack - so the app survives
# an IP change without anyone re-running Start-PMT-HRMS.
# ============================================================================
$ErrorActionPreference = 'SilentlyContinue'
$root    = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root 'docker-compose.local.yml'
$envFile = Join-Path $root '.env'
$log     = Join-Path $PSScriptRoot 'autostart.log'

. (Join-Path $PSScriptRoot '_pmt_common.ps1')

function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Out-File -FilePath $log -Append -Encoding UTF8 }

Log '----- auto-start invoked -----'

# Nothing to do until someone has run Start-PMT-HRMS once (creates .env + secrets).
if (-not (Test-Path $envFile)) { Log 'no .env yet - run Start-PMT-HRMS.bat once first. Skipping.'; exit 0 }

# Docker Desktop can take a while after logon - wait up to ~5 minutes.
for ($i = 0; $i -lt 60; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 5
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Log 'Docker not ready after waiting - will retry next logon. Skipping.'; exit 0 }

# Keep the team link + CORS pointed at the current address.
$ip = Get-LanIp
if (Update-EnvIp $envFile $ip) { Log "network address changed - updated .env to $ip" }
else { Log "network address unchanged ($ip)" }

Log 'bringing the stack up (docker compose up -d)'
docker compose -f $compose up -d *>> $log
Log "up. PMT http://${ip}:3001  HRMS http://${ip}:3000"
