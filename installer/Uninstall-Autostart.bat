@echo off
REM ==========================================================================
REM  PMT + HRMS - turn OFF automatic start (Windows). Double-click once.
REM  Removes the logon scheduled task. The app is NOT stopped and your data is
REM  kept; you can still start it with Start-PMT-HRMS.bat.
REM ==========================================================================
schtasks /Delete /TN "PMT-HRMS AutoStart" /F >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   Automatic start is OFF.
) else (
  echo   Automatic start was not enabled - nothing to remove.
)
echo   You can still start the app with Start-PMT-HRMS.bat.
echo.
pause
