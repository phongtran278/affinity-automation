# affinity-automation

Automation scripts for Affinity.

## Batch Export PDF High Quality

File:

`batch_export_pdf_high_quality.js`

Purpose:

- Export all open Affinity documents
- Keep the original base filename
- Convert `.af` → `.pdf`
- Use Affinity preset: `PDF (digital - high quality)`
- Export the whole document
- Export directly into a folder path
- Create the output folder automatically when it does not exist
- Warn before exporting into a non-empty folder

## Run with Script Manager

1. Open the `.af` documents you want to export in Affinity.
2. Run `Batch Export PDF High Quality`.
3. Enter the destination folder path.
4. If the folder does not exist, the script creates it automatically.
5. The script exports every open document into that folder.

Default output path:

```text
D:\PHONG_LAB\PDF_OUTPUT
```

You can replace it in the prompt with another path, including a new empty folder such as:

```text
D:\PHONG_LAB\PDF_OUTPUT\Batch_01
```

No dummy file is required.

## Local update workflow

The repository can live anywhere on the machine. `setup.ps1` uses its own folder automatically.

To update and install the latest script into Affinity Script Manager, double-click:

```text
update-and-install.bat
```

It will:

1. run `git pull --ff-only`
2. copy `batch_export_pdf_high_quality.js` into:
   `%APPDATA%\affinity-script-manager\MyScripts`
3. leave the script ready for Script Manager to refresh / Watch Mode to re-push

If Script Manager is already open and does not immediately show the new version, refresh it or reopen it.
