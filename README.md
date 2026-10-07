# affinity-automation

Automation toolkit for Affinity Designer workflows used in the ProHomes invoice project.

The repo currently focuses on three practical jobs:

- batch-edit ProHomes T7/2026 invoice PDFs;
- save multiple open documents as `.afdesign` faster;
- export multiple open Affinity documents to PDF.

---

## Requirements

Before running any launcher:

- Affinity Designer must be open;
- Affinity MCP / Script Manager bridge must be connected;
- Node.js must be installed;
- this repo must already be cloned locally;
- internet access is required when the launcher runs `git pull`.

The repo can live anywhere on the computer. The `.bat` files automatically run from their own folder.

---

## 1. Batch edit ProHomes T7/2026

### Main launcher

```text
run-batch-t7.bat
```

### Recommended workflow

1. Open the original T7 PDF files in Affinity Designer.
2. Open only the files you want to process in the current batch.
3. Double-click `run-batch-t7.bat`.
4. The launcher automatically runs `git pull --ff-only`.
5. A DRY RUN is executed first.
6. Review the result.
7. Only when every required document is `[OK]`, press `Y` to commit.
8. Affinity documents are updated in memory.
9. Save the edited documents as `.afdesign` when finished.

### Important safety rule

Do not commit when DRY RUN reports an error.

Expected summary before commit:

```text
SUCCESS: N ERROR: 0
```

If `ERROR` is greater than zero, stop and inspect the error first.

### Related launchers

```text
run-batch-t7-dry-run.bat
run-batch-t7-commit.bat
```

`run-batch-t7-dry-run.bat` is dry-run only.

`run-batch-t7-commit.bat` forwards to the combined workflow.

### Notes

- The batch edits only documents currently open in Affinity.
- Files outside the configured T7 batch are skipped.
- The script does not overwrite the original source PDFs on disk.
- The parser supports both separated and merged PDF text nodes because Affinity can import the same PDF differently on different computers.

---

## 2. Faster batch Save As to .afdesign

### Recommended launcher

```text
save-rest-afdesign.bat
```

This is the currently recommended practical workflow for saving many open PDF documents as Affinity files.

### Workflow

1. Open all PDFs you want to save in Affinity.
2. Save the first document manually:
   - press `Ctrl + Shift + S`;
   - choose the destination folder;
   - save it as `.afdesign`.
3. Return to Affinity.
4. Double-click `save-rest-afdesign.bat`.
5. The launcher automatically detects how many documents are open.
6. It processes the remaining documents using Affinity's Save As workflow.

Example:

```text
10 open PDFs
1 saved manually
save-rest-afdesign.bat
=> processes the remaining 9
```

### Important

This helper uses UI keyboard automation because the current Affinity scripting bridge exposes `saveAs()` but does not reliably write imported PDF documents to native `.afdesign` files headlessly.

While it is running:

- do not type;
- do not click inside another application;
- keep Affinity available in the foreground.

If the first manual Save As remembers the correct folder, the remaining saves are much faster.

---

## 3. Batch PDF export

### Launcher

```text
export-pdf.bat
```

### Workflow

1. Open the Affinity documents you want to export.
2. Double-click `export-pdf.bat`.
3. Choose the destination folder.
4. The exporter processes all currently open documents.
5. PDFs are moved into the selected folder automatically.

The PDF export workflow is more reliable than native `.afdesign` batch saving because Affinity exposes a working export API.

---

## 4. Update / install

### Launcher

```text
update-and-install.bat
```

Use this when setting up the repo on another computer or refreshing dependencies.

It performs the repo update and MCP client dependency setup.

---

## 5. Diagnostics

Diagnostics are for parser development only. They do not intentionally edit the active document.

### Full PDF text structure

```text
dump-affinity-structure.bat
```

Use when Affinity imports the same PDF differently on another machine.

### T7 paid/summary diagnostic

```text
diagnose-t7-paid.bat
```

Use when errors mention fields such as:

```text
Không tìm thấy tiền Đã thanh toán
Không tìm thấy Tổng phụ
Không tìm thấy VAT
```

The diagnostic prints the imported text-node structure so the parser can be adapted safely.

---

## Common troubleshooting

### `SKIPPED: outside batch / no STT`

The currently open file does not match the configured T7 batch naming / STT mapping.

Open the correct T7 source PDFs.

### `Không tìm thấy ...`

Affinity may have imported text nodes differently on that computer.

Run the relevant diagnostic on one representative original PDF and inspect the text-node dump.

### DRY RUN fails

Do not commit.

Fix the parser or source mismatch first, then run `run-batch-t7.bat` again.

### Script works on one computer but not another

This can happen because Affinity may split or merge imported PDF text differently depending on build, font environment, or PDF import behavior.

The current parser is designed to tolerate both separated and merged text-node layouts where known.

---

## Recommended daily workflow

For T7 invoice editing:

```text
Open original PDFs
        ↓
run-batch-t7.bat
        ↓
DRY RUN PASS
        ↓
Y = COMMIT
        ↓
Save first file manually as .afdesign
        ↓
save-rest-afdesign.bat
        ↓
export-pdf.bat when PDF output is needed
```

Keep the original PDFs unchanged as the source of truth.
