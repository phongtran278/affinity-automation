param([switch]$NoPull)

$ErrorActionPreference = "Stop"
$RepoDir = $PSScriptRoot
$SourceScript = Join-Path $RepoDir "batch_export_pdf_high_quality.js"
$MyScriptsDir = Join-Path $env:APPDATA "affinity-script-manager\MyScripts"
$TargetScript = Join-Path $MyScriptsDir "batch_export_pdf_high_quality.js"

Write-Host ""
Write-Host "Affinity Automation Setup" -ForegroundColor Cyan
Write-Host "Repo: $RepoDir"

if (-not $NoPull) {
  Write-Host "1/4 Git pull..."
  git -C $RepoDir pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "git pull that bai." }
}

Write-Host "2/4 MyScripts..."
New-Item -ItemType Directory -Force -Path $MyScriptsDir | Out-Null

Write-Host "3/4 Copy Affinity script..."
Copy-Item -Path $SourceScript -Destination $TargetScript -Force

Write-Host "4/4 Install one-click exporter dependency..."
Push-Location $RepoDir
try {
  npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install that bai." }
} finally { Pop-Location }

Write-Host ""
Write-Host "XONG" -ForegroundColor Green
Write-Host "Export bang cach double-click:"
Write-Host "  $RepoDir\export-pdf.bat"
