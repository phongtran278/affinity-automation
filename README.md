# affinity-automation

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