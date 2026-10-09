@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Checking branch...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="feature/multi-client" (
  echo ERROR: Switch to feature/multi-client before running this launcher.
  echo Current branch: %CURRENT_BRANCH%
  pause
  exit /b 1
)

echo.
echo [2/3] Updating source from GitHub...
git pull --ff-only origin feature/multi-client
if errorlevel 1 (
  echo GIT PULL FAILED. Check local changes and network connection.
  pause
  exit /b 1
)

echo.
echo [3/3] Running read-only Affinity T7 V2 preview...
node preview-affinity-t7-v2.mjs
if errorlevel 1 (
  echo PREVIEW FAILED. Check Affinity, MCP connection and Node.js.
  pause
  exit /b 1
)

echo.
echo DONE. Affinity documents were not edited.
pause
