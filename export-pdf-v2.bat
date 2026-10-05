@echo off
chcp 65001 >nul
setlocal
title Affinity PDF Export V2 - Invoice Date Name
cd /d "%~dp0"

set "LOG=%~dp0export-pdf-v2-last.log"

echo ================================================
echo Affinity PDF Export V2
echo Ten PDF = Ngay giao dich + Transaction ID
echo ================================================
echo.

if not exist "node_modules\@modelcontextprotocol\sdk" (
  echo Dang cai bo ho tro lan dau...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo [LOI] Cai dat dependency that bai.
    echo.
    echo Nhan phim bat ky de dong cua so...
    pause >nul
    exit /b 1
  )
)

echo Dang chay exporter V2...
echo Log: "%LOG%"
echo.

node "%~dp0export-pdf-v2.mjs" > "%LOG%" 2>&1
set "EXITCODE=%ERRORLEVEL%"

type "%LOG%"
echo.
echo ================================================
if "%EXITCODE%"=="0" (
  echo HOAN TAT V2 - ma thoat: %EXITCODE%
) else (
  echo CO LOI V2 - ma thoat: %EXITCODE%
)
echo ================================================
echo.
echo Cua so nay SE KHONG TU DONG DONG.
echo Nhan phim bat ky sau khi ong doc xong.
pause >nul
exit /b %EXITCODE%
