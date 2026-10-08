# T7 V2 non-mutating preview (sample data only).
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  & npm test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed — preview cancelled." }
  & node .\preview-t7-v2.mjs
  if ($LASTEXITCODE -ne 0) { throw "Preview failed." }
} finally { Pop-Location }
