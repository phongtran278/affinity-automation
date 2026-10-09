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

During COMMIT, if Affinity returns `COMMAND_FAILED` for any campaign field (name, date, campaign spend, ad-group spend, or impressions), the runner marks that campaign as `UNEDITABLE/CROSS-PAGE` for the current document. Remaining replacements for that campaign are not attempted; they are reported as explicit manual fallbacks. Other campaigns continue normally.

This is runtime-detected and must not be hard-coded to a specific STT or campaign index. Monetary validation still runs before COMMIT, so cross-page fallback never bypasses campaign/ad-group sum checks.
