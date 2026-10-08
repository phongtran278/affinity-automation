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
