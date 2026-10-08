# Read only preview of watermarked TEST documents currently open in Affinity.
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  & npm test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed - preview cancelled." }
  & node .\preview-affinity-t7-v2.mjs
  if ($LASTEXITCODE -ne 0) { throw "Affinity preview failed." }
} finally { Pop-Location }
