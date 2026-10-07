param(
  [Parameter(Mandatory=$true)]
  [int]$Count
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

$affinity = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'Affinity' -or $_.MainWindowTitle -match 'Affinity')
} | Select-Object -First 1

if (-not $affinity) { exit 1 }

[Microsoft.VisualBasic.Interaction]::AppActivate($affinity.Id) | Out-Null
Start-Sleep -Milliseconds 500

# File hiện tại đã được Save As thủ công.
# Chuyển sang file kế tiếp trước, rồi lưu các file còn lại.
for ($i=0; $i -lt $Count; $i++) {
  [System.Windows.Forms.SendKeys]::SendWait("^{TAB}")
  Start-Sleep -Milliseconds 300

  [System.Windows.Forms.SendKeys]::SendWait("^+s")
  Start-Sleep -Milliseconds 700

  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Milliseconds 900
}
