@echo off
setlocal
cd /d "%~dp0"

git pull --ff-only
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)

echo.
echo T7 PAID DIAGNOSTIC - chi de debug, khong sua file.
node diagnose-t7-paid.mjs

echo.
pause
