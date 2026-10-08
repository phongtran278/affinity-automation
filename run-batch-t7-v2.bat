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
echo [4/5] DRY RUN: preview current open documents...
set "T7_V2_EXPORT="
node edit-affinity-t7-v2.mjs
if errorlevel 1 (
  echo DRY RUN FAILED. No report exported.
  pause
  exit /b 1
)
echo.
choice /C YN /N /M "Dry run passed. Export read-only reconciliation reports? [Y/N]: "
if errorlevel 2 (
  echo Cancelled. No report exported and no invoice modified.
  pause
  exit /b 0
)
echo.
echo [5/5] Exporting separate reconciliation reports...
set "T7_V2_EXPORT=1"
node edit-affinity-t7-v2.mjs
if errorlevel 1 (
  echo EXPORT FAILED. Check the output above.
  pause
  exit /b 1
)
echo.
echo DONE. Reports saved. Original invoices were not modified.
pause
