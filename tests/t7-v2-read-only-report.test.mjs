import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const script = fs.readFileSync(fileURLToPath(new URL("../edit-affinity-t7-v2.mjs", import.meta.url)), "utf8");
const launcher = fs.readFileSync(fileURLToPath(new URL("../run-batch-t7-v2.bat", import.meta.url)), "utf8");
test("T7 v2 is read-only and does not require an invoice watermark", () => {
  assert.match(script, /mode: "READ_ONLY"/);
  assert.match(script, /periodStart/);
  assert.match(script, /proposedDescription/);
  assert.match(script, /\.json"/);
  assert.match(script, /\.csv"/);
  assert.doesNotMatch(script, /DocumentCommand|createSetText|executeCommand|TextSelection|watermarked/);
  assert.doesNotMatch(launcher, /AFFINITY_T7_V2_COMMIT|Committing text changes/);
});

test("T7 v2 aggregates verified source IDs and tracks missing documents", () => {
  assert.match(script, /t7-v2-42-progress\.json/);
  assert.match(script, /t7-v2-42-progress\.csv/);
  assert.match(script, /EXPECTED\.get\(Number\(row\.stt\)\)/);
  assert.match(script, /row\.transactionId === expected\.transactionId/);
  assert.match(script, /missing\.length === 0/);
  assert.match(script, /Missing STT:/);
});

test("T7 v2 compares complete split-node text and summarizes current open batch", () => {
  assert.match(script, /existing\.push\(complete\)/);
  assert.match(script, /CURRENT BATCH \(READ-ONLY\)/);
  assert.match(script, /CURRENT BATCH TOTAL:/);
  assert.match(script, /BEFORE:/);
  assert.match(script, /AFTER \(PROPOSED\):/);
  assert.doesNotMatch(script, /executeCommand|createSetText/);
});

test("T7 v2 keeps its standalone reconciliation report read-only", () => {
  assert.match(script, /process\\.env\\.T7_V2_EXPORT === "1"/);
  assert.doesNotMatch(script, /createSetText|executeCommand/);
  assert.match(launcher, /node run-t7-v2-workflow\\.mjs/);
  assert.doesNotMatch(launcher, /set "T7_V2_EXPORT=1"/);
});
