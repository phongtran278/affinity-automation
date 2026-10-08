@echo off
setlocal
cd /d "%~dp0"
title T7 V2 - TEST LAYOUT (READ ONLY)
echo ====================================================
echo T7 V2 - SAFE LAYOUT CHECK / READ ONLY
echo Does NOT modify or save Affinity/PDF documents.
echo ====================================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js and try again.
  goto :failed
)
if not exist "node_modules" (
  echo [ERROR] node_modules missing. Run npm install first.
  goto :failed
)
echo [1/2] Running repository tests...
call npm test
if errorlevel 1 (
  echo [ERROR] Tests failed. Preview cancelled.
  goto :failed
)
echo.
echo [2/2] Opening standalone TEST layout sample...
if not exist "sandbox-t7-v2-layout-test.html" (
  echo [ERROR] HTML layout sample not found.
  goto :failed
)
start "" "%~dp0sandbox-t7-v2-layout-test.html"
echo.
echo [OK] Sample opened. Affinity/PDF documents were not changed.
echo Compare font, size and width against the original sample.
pause
exit /b 0
:failed
echo.
echo [STOP] No document edits were attempted.
pause
exit /b 1
