# affinity-automation

## T7 V2: open PDFs -> DRY RUN -> confirm Y/N -> edit in Affinity

Use `run-batch-t7-v2.bat` while on the `feature/t7-v2` branch.

1. Open only the intended T7/2026 PDF documents in Affinity Designer; keep the Affinity Script Manager bridge running.
2. Run `run-batch-t7-v2.bat`. The launcher pulls updates and runs automated tests.
3. The workflow inspects **all open documents** with the existing T7 batch editor in **DRY RUN** mode, printing every BEFORE -> AFTER substitution without editing Affinity. It saves the text report under `reports/t7-v2-before-after-<timestamp>.txt` before asking for consent.
4. Inspect the terminal output or the saved report. A batch with any errors, skipped documents, or zero valid documents is rejected; there is no Y/N prompt.
5. Type **Y** to apply the validated T7 edit plan to the open Affinity documents in memory, or **N** to cancel without editing them.
6. Check the results in Affinity. **Saving/exporting is a separate manual step**: this workflow does not overwrite source PDF files on disk.

**Important:** This launcher uses the existing T7 batch engine and supports only the mapped T7 documents. Do not open unrelated files during this batch. An editing error can leave partial in-memory changes; inspect the documents before saving. The standalone `edit-affinity-t7-v2.mjs` remains a read-only period reconciliation utility, not the edit engine.

---


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

## T7 stable baseline

T7/2026 is the current stable reference implementation for future monthly batches.

### Stable components

- Data source: `data/prohomes-t7-2026.json`
- Main editor: `batch-edit-prohomes-t7.mjs`
- Main launcher: `run-batch-t7.bat`
- Dry-run compatibility launcher: `run-batch-t7-dry-run.bat`
- Commit alias: `run-batch-t7-commit.bat`

### What is already validated

- transaction ID replacement;
- invoice date replacement;
- paid amount, subtotal, VAT, total and payment-threshold handling;
- campaign spend redistribution;
- ad-group spend redistribution;
- impression scaling;
- campaign date generation;
- deterministic T7 campaign naming;
- invoice-number replacement;
- support for both separated PDF text nodes and merged PDF text nodes across different Affinity environments;
- fail-safe DRY RUN before commit.

### Invoice number rule

T7 keeps real invoice anchors unchanged and uses the agreed simulation/interpolation rule for synthetic rows under the `FBADS-179-` prefix.

The authoritative per-row invoice number is stored in `data/prohomes-t7-2026.json`.

### Safety rule

Treat T7 as a frozen baseline once it is working for production.

For T8/T9:

- clone the T7 logic into new month-specific files;
- create new month-specific JSON data;
- create new month-specific launchers;
- avoid changing T7 unless a regression or cross-machine compatibility issue is confirmed.

Recommended naming:

```text
data/prohomes-t8-2026.json
batch-edit-prohomes-t8.mjs
run-batch-t8.bat

data/prohomes-t9-2026.json
batch-edit-prohomes-t9.mjs
run-batch-t9.bat
```

This keeps each month isolated and prevents a T8/T9 parser change from breaking the working T7 workflow.

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
