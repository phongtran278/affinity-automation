param(
  [switch]$NoPull
)

$ErrorActionPreference = "Stop"

$RepoDir = "D:\PHONG_LAB\affinity-automation"
$SourceScript = Join-Path $RepoDir "batch_export_pdf_high_quality.js"
$ScriptManagerDir = Join-Path $env:APPDATA "affinity-script-manager"
$MyScriptsDir = Join-Path $ScriptManagerDir "MyScripts"
$TargetScript = Join-Path $MyScriptsDir "batch_export_pdf_high_quality.js"

Write-Host ""
Write-Host "Affinity Automation Setup" -ForegroundColor Cyan
Write-Host "------------------------"

if (-not (Test-Path $RepoDir)) {
    throw "Khong tim thay repo local: $RepoDir. Hay clone repo truoc."
}

if (-not $NoPull) {
    Write-Host "1/3 Dang cap nhat code tu GitHub..."
    git -C $RepoDir pull --ff-only
    if ($LASTEXITCODE -ne 0) {
        throw "git pull that bai."
    }
} else {
    Write-Host "1/3 Bo qua git pull (-NoPull)."
}

if (-not (Test-Path $SourceScript)) {
    throw "Khong tim thay script: $SourceScript"
}

Write-Host "2/3 Dang dam bao thu muc MyScripts ton tai..."
New-Item -ItemType Directory -Force -Path $MyScriptsDir | Out-Null

Write-Host "3/3 Dang copy script vao Script Manager..."
Copy-Item -Path $SourceScript -Destination $TargetScript -Force

Write-Host ""
Write-Host "XONG" -ForegroundColor Green
Write-Host "Script da duoc cap nhat tai:"
Write-Host "  $TargetScript"
Write-Host ""
Write-Host "Neu Script Manager dang mo ma chua thay ban moi, hay Reload/Refresh hoac mo lai Script Manager mot lan."