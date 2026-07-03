@echo off
REM ==========================================================================
REM  PMT + HRMS - turn ON automatic start (Windows). Double-click ONCE.
REM  Registers a logon scheduled task so the app starts by itself at every
REM  logon and always uses this PC's CURRENT network address - so the team link
REM  keeps working even after the IP changes. Undo with Uninstall-Autostart.bat.
REM ==========================================================================
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS=%SCRIPT_DIR%auto-start.ps1"

schtasks /Create /TN "PMT-HRMS AutoStart" ^
  /TR "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PS%\"" ^
  /SC ONLOGON /RL LIMITED /F

if %ERRORLEVEL% EQU 0 (
  echo.
  echo   Automatic start is ON.
  echo.
  echo   From now on, when you log in to this PC the app starts by itself and
  echo   always shows the correct link for today's network address.
  echo.
  echo   To turn this off, double-click Uninstall-Autostart.bat.
  echo   If you MOVE this folder, run this again.
) else (
  echo.
  echo   Could not turn on automatic start.
  echo   You can still run the app by double-clicking Start-PMT-HRMS.bat.
)
echo.
pause
