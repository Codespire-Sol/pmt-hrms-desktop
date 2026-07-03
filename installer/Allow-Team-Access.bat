@echo off
REM Opens the Windows Firewall so teammates on the same network can reach
REM PMT + HRMS. Double-click this once and approve the "Allow changes?" (UAC) prompt.

REM --- self-elevate to Administrator ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if (Get-NetFirewallRule -DisplayName 'PMT-HRMS-Local' -ErrorAction SilentlyContinue) { Write-Host 'Rule already exists.' } else { New-NetFirewallRule -DisplayName 'PMT-HRMS-Local' -Direction Inbound -Protocol TCP -LocalPort 3000,3001,4000 -Action Allow -Profile Any | Out-Null; Write-Host 'Firewall opened for ports 3000/3001/4000.' }"

echo.
echo Done. Your team can now open the shared link (e.g. http://192.168.1.50:3000).
pause
