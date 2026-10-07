@echo off
setlocal
cd /d "%~dp0"

git pull --ff-only >nul 2>&1

node get-open-docs-manifest.mjs >nul
if errorlevel 1 (
  echo Khong doc duoc danh sach document dang mo trong Affinity.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Chon folder luu tat ca file .afdesign'; $d.ShowNewFolderButton=$true; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){$d.SelectedPath}"`) do set "DEST=%%I"

if not defined DEST exit /b 0

powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0save-all-afdesign.ps1" -Destination "%DEST%"
if errorlevel 1 (
  echo.
  echo SAVE ALL FAILED.
  pause
  exit /b 1
)

echo.
echo XONG.
pause
