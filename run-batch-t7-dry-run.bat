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
echo [2/2] Running Affinity batch 01-42 in DRY RUN mode...
set AFFINITY_COMMIT=
node batch-edit-prohomes-t7.mjs
echo.
pause
