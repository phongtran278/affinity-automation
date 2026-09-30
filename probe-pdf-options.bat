@echo off
chcp 65001 >nul
setlocal
title Affinity PDF Options Probe
cd /d "%~dp0"

echo ================================================
echo Affinity PDF Options Probe
echo ================================================
echo.
echo Affinity va Script Manager/MCP phai dang mo va connected.
echo.
node "%~dp0probe-pdf-options.mjs"
set "EXITCODE=%ERRORLEVEL%"
echo.
echo ================================================
if "%EXITCODE%"=="0" (
  echo HOAN TAT
) else (
  echo CO LOI - ma thoat: %EXITCODE%
)
echo ================================================
echo.
echo Log:
echo %~dp0probe-pdf-options.log
echo.
echo Nhan phim bat ky de dong...
pause >nul
exit /b %EXITCODE%