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
echo [2/2] Running Affinity batch in COMMIT mode...
echo Only currently open Affinity documents with STT 01-42 will be processed.
echo PDF source files on disk are not overwritten automatically.
echo.

set AFFINITY_COMMIT=1
node batch-edit-prohomes-t7.mjs

echo.
pause
