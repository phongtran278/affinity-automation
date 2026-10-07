param(
  [Parameter(Mandatory=$true)]
  [string]$Destination
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-SaveAsDialog([int]$timeoutMs=5000) {
  $sw=[Diagnostics.Stopwatch]::StartNew()
  while($sw.ElapsedMilliseconds -lt $timeoutMs) {
    $root=[System.Windows.Automation.AutomationElement]::RootElement
    $wins=$root.FindAll(
      [System.Windows.Automation.TreeScope]::Children,
      [System.Windows.Automation.Condition]::TrueCondition
    )
    foreach($w in $wins) {
      try {
        if($w.Current.Name -eq "Save As") { return $w }
      } catch {}
    }
    Start-Sleep -Milliseconds 100
  }
  return $null
}

function Set-SaveAsTarget([string]$target) {
  $dlg=Get-SaveAsDialog 5000
  if(-not $dlg) { throw "Save As dialog not found" }

  # Standard Windows file dialog: File name edit uses AutomationId 1001.
  $edit=$dlg.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
      "1001"
    )
  )
  if(-not $edit) { throw "File name control not found" }

  $vp=$edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  $vp.SetValue($target)

  $saveBtn=$dlg.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    New-Object System.Windows.Automation.AndCondition(
      (New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button
      )),
      (New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        "Save"
      ))
    )
  )
  if(-not $saveBtn) {
    # Standard common-dialog Save button often has AutomationId 1.
    $saveBtn=$dlg.FindFirst(
      [System.Windows.Automation.TreeScope]::Descendants,
      New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
        "1"
      )
    )
  }
  if(-not $saveBtn) { throw "Save button not found" }

  $ip=$saveBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $ip.Invoke()
}

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
  Start-Sleep -Milliseconds 500

  # Set the exact target through Windows UI Automation instead of keyboard focus.
  try {
    Set-SaveAsTarget $target
  } catch {
    Write-Host ("[ERROR] Save As UI: " + $_.Exception.Message)
    exit 15
  }

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
