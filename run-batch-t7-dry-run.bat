@echo off
setlocal
cd /d "%~dp0"
echo This launcher is now merged into run-batch-t7.bat.
echo Running DRY RUN only...
echo.
git pull --ff-only
if errorlevel 1 (
  echo.
  echo GIT PULL FAILED.
  pause
  exit /b 1
)
set AFFINITY_COMMIT=
node batch-edit-prohomes-t7.mjs
echo.
pause
