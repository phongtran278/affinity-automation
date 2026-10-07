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
echo [2/2] Dumping Affinity text-node structure...
echo Open ONE representative PDF in Affinity Designer before continuing.
echo.
node dump-affinity-structure.mjs
echo.
pause
