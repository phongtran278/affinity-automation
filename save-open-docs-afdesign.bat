@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Updating source from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)

echo.
echo [2/3] Reading currently open Affinity documents...
node get-open-docs-manifest.mjs
if errorlevel 1 (
  echo FAILED TO READ OPEN DOCUMENTS.
  pause
  exit /b 1
)

echo.
echo [3/3] Saving through Affinity Save As dialogs...
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0save-open-docs-ui.ps1"

echo.
pause
