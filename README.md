# affinity-automation

## ProHomes T7/2026 batch edit

Main workflow:

1. Open only the PDF files you want to edit in Affinity Designer.
2. Double-click `run-batch-t7.bat`.
3. The launcher automatically runs `git pull --ff-only`.
4. It runs a full DRY RUN first and prints all planned changes.
5. If validation passes, Windows asks whether to commit.
6. Choose Yes to apply the changes to the currently open Affinity documents, or No to stop without editing anything.
7. Save As `.afdesign` manually when finished.

The batch does not export PDF and does not overwrite the source PDF files on disk.

`run-batch-t7-dry-run.bat` remains available as a dry-run-only compatibility launcher.
`run-batch-t7-commit.bat` calls the combined `run-batch-t7.bat`.

## One-click PDF export

1. Open the `.af` files in Affinity.
2. Double-click `export-pdf.bat`.
3. Windows opens a normal folder picker.
4. Choose the destination folder and press OK.
5. The exporter asks Affinity to export every open document with `PDF (digital - high quality)`.
6. PDFs are placed in the selected folder automatically.

No manual path entry. No dummy file. No second move step.

Internally, Affinity writes to its permitted Desktop area and the launcher immediately moves the PDFs to the selected folder. The temporary folder is deleted when empty.

## Update

Double-click `update-and-install.bat`.

This runs `git pull`, refreshes the Script Manager copy, and installs the MCP client dependency.

Affinity must be open and MCP must be enabled/connected.


## Diagnostic: dump PDF text structure

Use this only when refining the parser.

1. Open one representative PDF in Affinity Designer.
2. Double-click `dump-affinity-structure.bat`.
3. A JSON file is written under `diagnostics/`.
4. Send that JSON file back for parser development.

This diagnostic does not edit the document.
