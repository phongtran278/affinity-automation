@echo off
setlocal
cd /d "%~dp0"
echo [1/3] Checking branch...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="feature/multi-client" (
  echo ERROR: Please switch to feature/multi-client.
  pause
  exit /b 1
)
echo.
echo [2/3] Updating from GitHub...
git pull --ff-only origin feature/multi-client
if errorlevel 1 (
  echo GIT PULL FAILED.
  pause
  exit /b 1
)
echo.
echo [3/3] Running repository tests...
call npm test
if errorlevel 1 (
  echo TESTS FAILED.
  pause
  exit /b 1
)
echo.
echo Starting DRY RUN - BEFORE / AFTER - Y/N workflow...
node run-t7-v2-workflow.mjs
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo WORKFLOW FAILED. Review report and Affinity documents.
)
pause
exit /b %RESULT%
