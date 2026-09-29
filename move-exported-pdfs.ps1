Add-Type -AssemblyName System.Windows.Forms

$ErrorActionPreference = "Stop"

$Desktop = [Environment]::GetFolderPath("Desktop")

$SourceFolder = Get-ChildItem -Path $Desktop -Directory -Filter "Affinity_PDF_Export_*" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $SourceFolder) {
    [System.Windows.Forms.MessageBox]::Show(
        "Khong tim thay batch PDF nao tren Desktop.`nHay export tu Affinity truoc.",
        "Affinity PDF Export",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
    exit 1
}

$PdfFiles = Get-ChildItem -Path $SourceFolder.FullName -File -Filter "*.pdf"

if (-not $PdfFiles) {
    [System.Windows.Forms.MessageBox]::Show(
        "Folder staging moi nhat khong co file PDF.`n$($SourceFolder.FullName)",
        "Affinity PDF Export",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
}

$Dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$Dialog.Description = "Chon folder de luu $($PdfFiles.Count) file PDF"
$Dialog.ShowNewFolderButton = $true
$Dialog.UseDescriptionForTitle = $true

$Result = $Dialog.ShowDialog()

if ($Result -ne [System.Windows.Forms.DialogResult]::OK) {
    exit 0
}

$Destination = $Dialog.SelectedPath
$Existing = Get-ChildItem -Path $Destination -Force -ErrorAction SilentlyContinue

if ($Existing) {
    $Answer = [System.Windows.Forms.MessageBox]::Show(
        "Folder da co file ben trong.`n`n$Destination`n`nVan tiep tuc?",
        "Folder khong trong",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($Answer -ne [System.Windows.Forms.DialogResult]::Yes) {
        exit 0
    }
}

$Moved = 0
$Skipped = @()

foreach ($File in $PdfFiles) {
    $Target = Join-Path $Destination $File.Name

    if (Test-Path $Target) {
        $Skipped += $File.Name
        continue
    }

    Move-Item -LiteralPath $File.FullName -Destination $Target
    $Moved++
}

$Remaining = Get-ChildItem -Path $SourceFolder.FullName -Force -ErrorAction SilentlyContinue
if (-not $Remaining) {
    Remove-Item -LiteralPath $SourceFolder.FullName -Force
}

$Message = "Xong.`n`nDa chuyen: $Moved/$($PdfFiles.Count) file`nFolder:`n$Destination"

if ($Skipped.Count -gt 0) {
    $Message += "`n`nBo qua vi trung ten:`n" + ($Skipped -join "`n")
}

[System.Windows.Forms.MessageBox]::Show(
    $Message,
    "Affinity PDF Export",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null