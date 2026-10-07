param(
  [Parameter(Mandatory=$true)]
  [string]$Destination
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

$manifestPath = Join-Path $PSScriptRoot "open-docs-save-manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Host "ERROR: manifest not found."
  exit 2
}

$docs = @(Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
if ($docs.Count -eq 0) {
  Write-Host "ERROR: no open documents."
  exit 3
}

function Make-OutputName([string]$title, [int]$index) {
  $name = [IO.Path]::GetFileName($title)
  $name = $name -replace '\.(pdf|afdesign)$',''
  if ([string]::IsNullOrWhiteSpace($name)) {
    $name = ("Document_{0:D2}" -f ($index+1))
  }
  foreach ($c in [IO.Path]::GetInvalidFileNameChars()) {
    $name = $name.Replace([string]$c, "_")
  }
  return ($name + ".afdesign")
}

function Wait-ForFile([string]$path, [int]$timeoutMs=6000) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
    if (Test-Path -LiteralPath $path) { return $true }
    Start-Sleep -Milliseconds 150
  }
  return $false
}

$affinity = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'Affinity' -or $_.MainWindowTitle -match 'Affinity')
} | Select-Object -First 1

if (-not $affinity) {
  Write-Host "ERROR: Affinity window not found."
  exit 4
}

[Microsoft.VisualBasic.Interaction]::AppActivate($affinity.Id) | Out-Null
Start-Sleep -Milliseconds 500

Write-Host ""
Write-Host ("Saving " + $docs.Count + " document(s) to:")
Write-Host $Destination
Write-Host ""

for ($i=0; $i -lt $docs.Count; $i++) {
  $title = [string]$docs[$i].title
  $filename = Make-OutputName $title $i
  $target = Join-Path $Destination $filename

  # Remove existing file first so Save As never opens an overwrite confirmation.
  if (Test-Path -LiteralPath $target) {
    try {
      Remove-Item -LiteralPath $target -Force -ErrorAction Stop
    } catch {
      Write-Host ("[ERROR] Cannot overwrite: " + $target)
      exit 10
    }
  }

  # Open Affinity Save As.
  [System.Windows.Forms.SendKeys]::SendWait("^+s")
  Start-Sleep -Milliseconds 850

  # Focus File name field, paste full path through clipboard (Unicode-safe), save.
  [System.Windows.Forms.SendKeys]::SendWait("%n")
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.Clipboard]::SetText($target)
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

  if (-not (Wait-ForFile $target 6500)) {
    Write-Host ("[ERROR] Save failed: " + $filename)
    Write-Host "Stopped immediately; remaining documents were not touched."
    exit 20
  }

  Write-Host ("[OK] " + $filename)

  if ($i -lt ($docs.Count-1)) {
    [System.Windows.Forms.SendKeys]::SendWait("^{TAB}")
    Start-Sleep -Milliseconds 350
  }
}

Write-Host ""
Write-Host ("DONE: " + $docs.Count + "/" + $docs.Count)
