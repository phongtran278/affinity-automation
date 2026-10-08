@echo off
setlocal
cd /d "%~dp0"
title T7 V2 - ONE TEST DOCUMENT
echo =================================================
echo T7 V2 - ONE DOCUMENT / TEST ONLY
echo Target: 01 - 27550587294121927-27712933945890324.pdf
echo Requires a visible TEST watermark in Affinity text.
echo The script will NOT save or export any PDF.
echo =================================================
echo.
where node >nul 2>&1
if errorlevel 1 goto :failed
if not exist "node_modules" goto :failed
call npm test
if errorlevel 1 goto :failed
echo.
echo [1] Dry run - read-only check on document 01
set "AFFINITY_T7_V2_COMMIT=0"
node ".\test-one-affinity-t7-v2.mjs"
if errorlevel 1 goto :failed
echo.
echo [2] This will change text IN MEMORY on exactly one TEST-marked document.
choice /C YN /M "Proceed with the one-document experiment"
if errorlevel 2 goto :cancel
set "AFFINITY_T7_V2_COMMIT=1"
node ".\test-one-affinity-t7-v2.mjs"
if errorlevel 1 goto :failed
echo.
echo [DONE] Inspect font, size, line breaks in Affinity.
echo Do NOT overwrite the source PDF. Save only a TEST-marked sample.
pause
exit /b 0
:cancel
echo Cancelled. Nothing changed.
pause
exit /b 0
:failed
echo.
echo [STOP] Check Node.js, dependencies, the TEST watermark,
echo and that the target PDF 01 is open in Affinity.
pause
exit /b 1
