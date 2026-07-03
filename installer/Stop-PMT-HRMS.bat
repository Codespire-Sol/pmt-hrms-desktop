@echo off
REM Double-click this file to stop PMT + HRMS. Your data is preserved.
echo Stopping PMT + HRMS...
docker compose -f "%~dp0..\docker-compose.local.yml" stop
echo.
echo Stopped. All data is kept. Double-click Start-PMT-HRMS.bat to start again.
pause
