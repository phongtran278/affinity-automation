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
- Choose the destination folder indirectly by selecting any file inside that folder

## Run with Script Manager

1. Open the `.af` documents you want to export in Affinity.
2. Open Script Manager for Affinity.
3. Add or reference `batch_export_pdf_high_quality.js` from your local clone.
4. Run the script.
5. When prompted, choose any file inside the folder where you want the PDFs saved.
6. The script exports the open documents using the high-quality PDF preset.

## Recommended local setup

Clone once:

```powershell
cd "$env:USERPROFILE\Documents"
git clone https://github.com/phongtran278/affinity-automation.git
```

Update later:

```powershell
cd "$env:USERPROFILE\Documents\affinity-automation"
git pull
```

Then keep Script Manager pointed at the local JS file.

## Update workflow

Future script changes can be committed to this repository. On the Windows machine, run `git pull` to get the latest version before running the script.
