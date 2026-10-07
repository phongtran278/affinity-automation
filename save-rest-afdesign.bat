@echo off
setlocal
cd /d "%~dp0"

git pull --ff-only >nul 2>&1

for /f %%I in ('node get-open-doc-count.mjs') do set "TOTAL=%%I"
if not defined TOTAL (
  echo Khong doc duoc so file dang mo trong Affinity.
  pause
  exit /b 1
)

set /a REMAINING=TOTAL-1
if %REMAINING% LEQ 0 (
  echo Khong co file nao con lai de Save As.
  pause
  exit /b 0
)

powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0save-rest-afdesign.ps1" -Count %REMAINING%

echo.
echo XONG - da xu ly %REMAINING% file con lai.
pause
