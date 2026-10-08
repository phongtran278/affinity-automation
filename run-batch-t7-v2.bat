@echo off
setlocal
cd /d "%~dp0"
echo [1/4] Checking branch...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="feature/t7-v2" (
  echo ERROR: Please switch to feature/t7-v2.
  pause
  exit /b 1
)
echo.
echo [2/4] Updating from GitHub...
git pull --ff-only origin feature/t7-v2
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)
echo.
echo [3/4] Running repository tests...
call npm test
if errorlevel 1 (
  echo TESTS FAILED.
  pause
  exit /b 1
)
echo.
echo [4/4] Creating READ-ONLY reconciliation reports...
node edit-affinity-t7-v2.mjs
if errorlevel 1 (
  echo REPORT ERROR. Inspect the output above.
  pause
  exit /b 1
)
echo.
echo DONE. Find CSV and JSON in the reports folder.
echo No Affinity document or original invoice was modified.
pause
