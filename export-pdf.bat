@echo off
cd /d "%~dp0"

if not exist "node_modules\@modelcontextprotocol\sdk" (
  echo Dang cai bo ho tro lan dau...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo Cai dat that bai.
    pause
    exit /b 1
  )
)

node "%~dp0export-pdf.mjs"
if errorlevel 1 (
  echo.
  pause
)