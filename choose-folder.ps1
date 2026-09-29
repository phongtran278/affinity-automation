[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms

$Dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$Dialog.Description = "Chọn folder để lưu PDF"
$Dialog.ShowNewFolderButton = $true
try { $Dialog.UseDescriptionForTitle = $true } catch {}

$Result = $Dialog.ShowDialog()
if ($Result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $Dialog.SelectedPath
}