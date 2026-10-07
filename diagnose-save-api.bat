@echo off
setlocal
cd /d "%~dp0"
git pull --ff-only
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)
node diagnose-save-api.mjs
echo.
pause
