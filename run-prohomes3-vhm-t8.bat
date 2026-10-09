@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Updating source from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo GIT PULL FAILED.
  pause
  exit /b 1
)

echo.
echo [2/3] Running ProHomes3 VHM T8 DRY RUN...
set AFFINITY_COMMIT=
node batch-edit-prohomes3-vhm-t8.mjs
if errorlevel 1 (
  echo.
  echo DRY RUN FAILED. Commit cancelled.
  pause
  exit /b 1
)

echo.
choice /M "VHM T8 dry run passed. Commit changes to the currently open Affinity documents"
if errorlevel 2 (
  echo.
  echo Commit cancelled. No document was changed.
  pause
  exit /b 0
)

echo.
echo [3/3] Running ProHomes3 VHM T8 COMMIT...
set AFFINITY_COMMIT=1
node batch-edit-prohomes3-vhm-t8.mjs
if errorlevel 1 (
  echo.
  echo COMMIT INCOMPLETE OR FAILED. Check PARTIAL / MANUAL_REQUIRED or the error above.
  pause
  exit /b 1
)

echo.
echo VHM T8 DONE.
pause
