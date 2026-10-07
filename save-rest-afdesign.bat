@echo off
setlocal
cd /d "%~dp0"

git pull --ff-only >nul 2>&1

set COUNT=9
if not "%~1"=="" set COUNT=%~1

powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0save-rest-afdesign.ps1" -Count %COUNT%

echo.
pause
