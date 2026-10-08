# Safe inspection launcher: runs tests and Affinity DRY RUN only.
# Compatible with Windows PowerShell 5.1 and PowerShell 7.
param(
  [string]$LogDirectory = "diagnostics"
)

$ErrorActionPreference = "Stop"
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$previousCommit = [Environment]::GetEnvironmentVariable("AFFINITY_COMMIT", "Process")
$exitCode = 0

Push-Location $repoDir
try {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or not in PATH."
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not installed or not in PATH."
  }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not installed or not in PATH."
  }

  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne "refactor/modular-core") {
    throw "Please switch to refactor/modular-core first. Current branch: $branch"
  }

  Write-Host "[1/2] Checking T7 code and data..." -ForegroundColor Cyan
  & npm test
  if ($LASTEXITCODE -ne 0) {
    throw "Regression tests failed. Affinity dry run was NOT started."
  }

  $logPath = Join-Path $repoDir $LogDirectory
  New-Item -ItemType Directory -Path $logPath -Force | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $logFile = Join-Path $logPath ("t7-dry-run-" + $stamp + ".log")

  Write-Host "[2/2] Checking documents currently open in Affinity (NO CHANGES)..." -ForegroundColor Cyan
  $env:AFFINITY_COMMIT = "0"
  & node (Join-Path $repoDir "batch-edit-prohomes-t7.mjs") 2>&1 | Tee-Object -FilePath $logFile
  $exitCode = $LASTEXITCODE
  Write-Host ("Report saved to: " + $logFile)
  if ($exitCode -ne 0) {
    throw "DRY RUN reported an error. No commit was attempted."
  }

  Write-Host "DONE: Tests and dry run passed. No edits or saves were performed." -ForegroundColor Green
} catch {
  Write-Error $_.Exception.Message
  $exitCode = 1
} finally {
  [Environment]::SetEnvironmentVariable("AFFINITY_COMMIT", $previousCommit, "Process")
  Pop-Location
}
exit $exitCode
