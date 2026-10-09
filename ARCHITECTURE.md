# Affinity Automation Architecture

This repository uses a stable core + profile + rule architecture.

## Branching model

- `main`: stable framework only.
- `refactor/modular-core`: modularisation work until T7 regression passes.
- `feature/t8-2026`: T8 data/profile work.
- `feature/t9-2026`: T9 data/profile work.
- `fix/<module>-<case>`: isolated parser fixes.

Never experiment directly on `main`.

## Design rule

Invoices are expected to share most structure, but fields can vary by invoice.

Every field must be treated as one of:

- `REQUIRED`
- `OPTIONAL`
- `DERIVED`
- `NOT_APPLICABLE`

A missing REQUIRED field fails that document.
A missing OPTIONAL field is reported and skipped.
A DERIVED field may be calculated from validated source fields.
A NOT_APPLICABLE field must not be searched or edited.

## Core pipeline

`SCAN -> PLAN -> VALIDATE -> COMMIT -> POST-VALIDATE`

The commit phase must never guess.

If a required target is ambiguous, fail the current document instead of choosing one.

## Module boundaries

- source/profile validation
- document identity and STT matching
- PDF text-node compatibility
- invoice header
- payment summary
- campaigns
- impressions
- invoice number
- planner/validator/commit

If a new invoice only breaks one module, patch that module only.
Do not rewrite unrelated modules or the whole parser.

## PDF compatibility

Affinity may import the same PDF differently between computers.

Known layouts:

- separated text nodes;
- merged text nodes;
- label + value in one node;
- label and value in adjacent nodes;
- campaign name + date in one node;
- campaign name and date in separate nodes.

Compatibility logic must preserve all already passing layouts.

## Optional payment threshold

`paymentThreshold` is OPTIONAL.

If present, update it using the configured rule.
If absent, report `OPTIONAL / NOT PRESENT` and continue.
More than one threshold target remains an ambiguity error.

## Safety invariants

- original PDFs are never overwritten;
- DRY RUN must pass before COMMIT;
- ranges are validated before edit;
- replacements on one text node are committed from right to left;
- campaign spend sum must equal subtotal;
- ad-group spend sum must equal campaign spend;
- subtotal + VAT must equal total;
- invoice-number commit failure may degrade to an explicit warning only when the profile allows it.

## AI maintenance contract

When an AI edits this repo:

1. Make the smallest safe patch.
2. Do not modify `main` for experiments.
3. Do not change T7 behaviour unless a regression is proven.
4. Do not assume text nodes are always split the same way.
5. Do not convert OPTIONAL fields into REQUIRED fields without evidence.
6. Do not change JSON schema casually.
7. Do not rewrite the full parser for a local bug.
8. Preserve backward compatibility with all previously passing layouts.
9. Run T7 dry-run regression before merging a core/module change.
10. If confidence is low or multiple targets match, fail safely.

## Month profile convention

Month-specific configuration belongs in:

`profiles/prohomes-tN.mjs`

Month-specific data belongs in:

`data/prohomes-tN-2026.json`

Launchers remain:

`run-batch-tN.bat`

The shared parser/core should not contain hard-coded T7/T8/T9 business rules unless they are true cross-month defaults.


## Cross-page campaign guard

Campaigns may continue onto a later PDF page. Parsing and validation must remain document-wide, not page-local.

During COMMIT, imported PDF text may be readable/searchable but still reject `replaceRange()`. The runner treats that as a runtime editability condition, never as a value-specific exception.

If Affinity returns `COMMAND_FAILED` for any campaign field (name, date, campaign spend, ad-group spend, or impressions), that campaign is marked `UNEDITABLE` for the current document (a common cause is a campaign continuing onto another page). Remaining replacements for that campaign are not attempted; they are reported as explicit manual fallbacks. If an invoice-number text node rejects editing, that node is likewise reported as an `UNEDITABLE TEXT NODE` manual fallback.

This must never be hard-coded to a specific STT, campaign index, page number, or invoice value. Monetary validation still runs before COMMIT, so the fallback cannot bypass campaign/ad-group sum checks.


## Completion status semantics

A document is `SUCCESS/PASS` only when every planned REQUIRED replacement has been committed and post-validated in the Affinity document.

If parsing and numeric validation pass but one or more required replacements cannot be committed because Affinity rejects the imported PDF text node, the document is `PARTIAL / MANUAL_REQUIRED`, not `SUCCESS`. The runner must report every unresolved old -> new value explicitly.

`PARTIAL` is distinct from `ERROR`: it means the source data and plan are valid, but the document does not yet match the source of truth and requires manual edits. Post-validation may skip only the exact replacements that were explicitly recorded as unresolved; those unresolved replacements must keep the document in `PARTIAL` status.

Summary counts must keep `SUCCESS`, `PARTIAL`, `ERROR`, and `SKIPPED` separate.


## Spread-aware text editing

Affinity selections are spread-sensitive. Before editing any imported PDF text node, the runner must compare `node.spread` with `doc.currentSpread`. If they differ, execute `DocumentCommand.createSetCurrentSpread(node.spread)` before creating the node/text selection.

This is required for campaigns, invoice numbers, and any other text that continues onto later PDF pages. Detection must be runtime-based through the node's spread; never hard-code page numbers, STTs, campaign indexes, or invoice values.

The manual/uneditable fallback remains only for genuine command failures after the correct spread has been activated.


## Cross-machine text alignment

Imported PDF text can carry different paragraph-alignment metadata on different Affinity installations. Do not rely on the imported alignment for semantic campaign labels.

During COMMIT, the shared core normalizes campaign-name and ad-group-name text nodes to left paragraph alignment after activating the node's spread. Date ranges, impressions, and monetary columns are not reformatted by this rule.

This rule is semantic and cross-month. Never hard-code STTs, pages, or individual campaign names to repair alignment.
