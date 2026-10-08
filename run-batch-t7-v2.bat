@echo off
setlocal
cd /d "%~dp0"

echo [1/5] Checking branch...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="feature/t7-v2" (
  echo ERROR: Please switch to feature/t7-v2.
  echo Current branch: %CURRENT_BRANCH%
  pause
  exit /b 1
)

echo.
echo [2/5] Updating from GitHub...
git pull --ff-only origin feature/t7-v2
if errorlevel 1 (
  echo GIT PULL FAILED. No Affinity changes were made by this launcher.
  pause
  exit /b 1
)

echo.
echo [3/5] Running repository tests...
call npm test
if errorlevel 1 (
  echo TESTS FAILED. Commit cancelled.
  pause
  exit /b 1
)

echo.
echo [4/5] Dry run: validate every open document...
set "AFFINITY_T7_V2_COMMIT="
node edit-affinity-t7-v2.mjs
if errorlevel 1 (
  echo DRY RUN FAILED. Commit cancelled. Review errors above.
  pause
  exit /b 1
)

echo.
choice /M "Dry run passed. Update ad-spend-period sentences in open Affinity documents"
if errorlevel 2 (
  echo Commit cancelled. No Affinity text changes.
  pause
  exit /b 0
)

echo.
echo [5/5] Committing text changes in Affinity...
set "AFFINITY_T7_V2_COMMIT=1"
node edit-affinity-t7-v2.mjs
if errorlevel 1 (
  echo COMMIT ERROR. Inspect open Affinity documents before retrying.
  pause
  exit /b 1
)

echo.
echo DONE. Save edited Affinity documents manually with Save As.
echo Original PDF files were not saved or overwritten by this script.
pause
