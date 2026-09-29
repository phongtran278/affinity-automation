# affinity-automation

Automation scripts for Affinity.

## Batch Export PDF High Quality

Affinity scripting has restricted filesystem access. The reliable workflow is:

1. Affinity exports to a temporary staging folder on the Windows Desktop.
2. A small PowerShell helper opens the native Windows folder picker.
3. Choose any destination folder, including an empty folder.
4. The helper moves the exported PDFs there.

This avoids typing paths and avoids Affinity permission errors for arbitrary drives/folders.

### Files

- `batch_export_pdf_high_quality.js`
- `move-exported-pdfs.ps1`
- `move-exported-pdfs.bat`
- `update-and-install.bat`

### Export workflow

1. Open all `.af` documents you want to export.
2. Run `Batch Export PDF High Quality` in Affinity / Script Manager.
3. Affinity exports them with `PDF (digital - high quality)`.
4. Double-click `move-exported-pdfs.bat`.
5. A normal Windows folder picker opens.
6. Select the destination folder.
7. PDFs are moved there.

No dummy file and no manual path entry are required.

### Updating

Double-click `update-and-install.bat`.

This pulls the latest GitHub version and copies the Affinity JS script into Script Manager `MyScripts`.