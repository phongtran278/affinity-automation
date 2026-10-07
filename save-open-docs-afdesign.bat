@echo off
setlocal
cd /d "%~dp0"

git pull --ff-only >nul 2>&1
node get-open-docs-manifest.mjs >nul
if errorlevel 1 (
  echo Khong doc duoc danh sach file dang mo trong Affinity.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -Command "$d=New-Object System.Windows.Forms.FolderBrowserDialog; Add-Type -AssemblyName System.Windows.Forms; $d.Description='Chon folder luu cac file .afdesign'; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){$d.SelectedPath}"`) do set "DEST=%%I"

if not defined DEST exit /b 0

powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0save-open-docs-ui.ps1" -Destination "%DEST%"

echo.
echo XONG.
pause
