# affinity-automation

## ProHomes T7/2026 batch edit

Main workflow:

1. Open only the PDF files you want to edit in Affinity Designer.
   - Affinity can be handled in the existing batches: `1-10`, `11-20`, `21-30`, `31-40`, `41-42`.
   - It is fine to omit files that do not need editing.
2. Double-click `run-batch-t7.bat`.
3. The launcher automatically runs `git pull --ff-only`.
4. It loads `data/prohomes-t7-2026.json`.
5. Each open document is matched by the numeric prefix in its title, e.g. `01 - ...pdf` -> STT 01.
6. The runner validates the planned changes and commits them directly to the open Affinity documents.
7. Save As `.afdesign` manually when finished.

The batch does not export PDF and does not overwrite the source PDF files on disk.

### Safety / testing

`run-batch-t7-dry-run.bat` remains available for parser/source testing. It validates and reports but does not change document text.

`run-batch-t7-commit.bat` is kept as a compatibility alias and now calls `run-batch-t7.bat`.

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
