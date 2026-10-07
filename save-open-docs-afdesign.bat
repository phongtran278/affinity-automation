@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Updating source from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo GIT PULL FAILED.
  pause
  exit /b 1
)

echo.
echo [2/2] Save all currently open Affinity documents as .afdesign...
node save-open-docs-afdesign.mjs

echo.
pause
