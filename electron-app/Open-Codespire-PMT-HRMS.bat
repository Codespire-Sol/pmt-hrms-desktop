@echo off
REM Double-click to open Codespire PMT-HRMS (test/dev mode).
REM This runs the app from source. The real installed .exe comes from Stage 2.
cd /d "%~dp0"
echo Starting Codespire PMT-HRMS...
call pnpm start
