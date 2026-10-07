param(
  [Parameter(Mandatory=$true)]
  [string]$Destination
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

function Escape-SendKeys([string]$s) {
  return $s.Replace("{","{{}").Replace("}","{}}").Replace("+","{+}").Replace("^","{^}").Replace("%","{%}").Replace("~","{~}").Replace("(","{(}").Replace(")","{)}").Replace("[","{[}").Replace("]","{]}")
}

function Output-Name([string]$title,[int]$index) {
  $name = $title -replace '\.(pdf|afdesign)$','.afdesign'
  if ($name -eq $title) { $name = $title + '.afdesign' }
  return $name
}

$manifest = Join-Path $PSScriptRoot "open-docs-save-manifest.txt"
if (-not (Test-Path -LiteralPath $manifest)) { exit 2 }

$docs = @(Get-Content -LiteralPath $manifest -Encoding UTF8 | Where-Object { $_.Trim() -ne "" })
if ($docs.Count -eq 0) { exit 3 }

$affinity = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'Affinity' -or $_.MainWindowTitle -match 'Affinity')
} | Select-Object -First 1
if (-not $affinity) { exit 4 }

[Microsoft.VisualBasic.Interaction]::AppActivate($affinity.Id) | Out-Null
Start-Sleep -Milliseconds 500

for ($i=0; $i -lt $docs.Count; $i++) {
  $title = [string]$docs[$i]
  $filename = Output-Name $title ($i+1)
  $target = Join-Path $Destination $filename

  # Save As
  [System.Windows.Forms.SendKeys]::SendWait("^+s")
  Start-Sleep -Milliseconds 800

  # Windows Save As dialog: focus File name, type full path, save.
  [System.Windows.Forms.SendKeys]::SendWait("%n")
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  [System.Windows.Forms.SendKeys]::SendWait((Escape-SendKeys $target))
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Milliseconds 900

  # If overwrite confirmation appears, confirm Yes.
  if (Test-Path -LiteralPath $target) {
    # already saved/overwritten
  } else {
    [System.Windows.Forms.SendKeys]::SendWait("%y")
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 700
  }

  if ($i -lt ($docs.Count-1)) {
    [System.Windows.Forms.SendKeys]::SendWait("^{TAB}")
    Start-Sleep -Milliseconds 300
  }
}
