// Unified T7 V2 workflow: dry run, report, explicit consent, then Affinity edit.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

export function parseBatchSummary(output) {
  const matches = [...String(output).matchAll(/SUCCESS:\s*(\d+)\s+ERROR:\s*(\d+)\s+SKIPPED:\s*(\d+)/g)];
  if (!matches.length) throw new Error("No valid batch summary returned by Affinity.");
  const [, success, error, skipped] = matches[matches.length - 1];
  return { success: Number(success), error: Number(error), skipped: Number(skipped) };
}

export async function runWorkflow({ execute, confirm, saveReport, log = console.log }) {
  log("[1/3] DRY RUN - BEFORE / AFTER (no Affinity changes)");
  const preview = await execute(false);
  // Save the inspection log regardless of pass/fail so errors can be diagnosed.
  const reportPath = await saveReport(preview.output);
  log("DRY RUN report: " + reportPath);
  if (preview.status !== 0) {
    log("DRY RUN FAILED. No Affinity documents modified.");
    return 1;
  }
  let summary;
  try { summary = parseBatchSummary(preview.output); }
  catch (error) { log(error.message); return 1; }
  // Do not silently leave open PDFs unprocessed.
  if (summary.success === 0 || summary.error !== 0 || summary.skipped !== 0) {
    log("ABORT: every open document must pass validation. " +
      `SUCCESS=${summary.success} ERROR=${summary.error} SKIPPED=${summary.skipped}`);
    return 1;
  }
  log("[2/3] Review the BEFORE / AFTER report before confirming.");
  const answer = String(await confirm()).trim().toUpperCase();
  if (answer !== "Y") {
    log("Cancelled (N). No Affinity documents modified.");
    return 0;
  }
  log("[3/3] Y confirmed. Editing the open documents in Affinity...");
  const commit = await execute(true);
  if (commit.status !== 0) {
    log("COMMIT FAILED. Some documents may have changed in memory; inspect Affinity before saving.");
    return 1;
  }
  const applied = parseBatchSummary(commit.output);
  if (applied.error || applied.skipped || applied.success !== summary.success) {
    log("COMMIT RESULT DIFFERS FROM DRY RUN. Inspect the documents before saving.");
    return 1;
  }
  log("DONE: " + applied.success + " documents edited in Affinity memory.");
  log("Source PDFs on disk are not automatically overwritten. Save/export explicitly.");
  return 0;
}

async function main() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const script = path.join(root, "batch-edit-prohomes-t7.mjs");
  const execute = async (commit) => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, AFFINITY_COMMIT: commit ? "1" : "0" },
      maxBuffer: 16 * 1024 * 1024
    });
    const output = (result.stdout || "") + (result.stderr || "");
    process.stdout.write(output);
    if (result.error) throw result.error;
    return { status: result.status ?? 1, output };
  };
  const saveReport = async (output) => {
    const dir = path.join(root, "reports");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(dir, `t7-v2-before-after-${stamp}.txt`);
    fs.writeFileSync(destination, output, "utf8");
    return destination;
  };
  const confirm = async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { return await rl.question("Confirm changes to ALL currently open Affinity documents? [Y/N]: "); }
    finally { rl.close(); }
  };
  process.exitCode = await runWorkflow({ execute, confirm, saveReport });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error("WORKFLOW FAILED:", e.stack || String(e)); process.exitCode = 1; });
}
