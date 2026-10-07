@echo off
setlocal
cd /d "%~dp0"
echo WARNING: COMMIT MODE will edit validated text in open Affinity documents.
echo No PDF export will run.
echo.
choice /M "Continue"
if errorlevel 2 exit /b 0
git pull --ff-only
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)
set AFFINITY_COMMIT=1
node batch-edit-prohomes-t7.mjs
echo.
pause
