import test from "node:test";
import assert from "node:assert/strict";
import { parseBatchSummary, runWorkflow } from "../run-t7-v2-workflow.mjs";

test("parses the last Affinity batch summary", () => {
  assert.deepEqual(parseBatchSummary("SUCCESS: 1 ERROR: 0 SKIPPED: 0\nSUCCESS: 3 ERROR: 0 SKIPPED: 0"), {success:3,error:0,skipped:0});
  assert.throws(() => parseBatchSummary("no report"), /No valid batch summary/);
});
function harness({ dryStatus=0, dryOutput="SUCCESS: 2 ERROR: 0 SKIPPED: 0", answer="Y", commitStatus=0, commitOutput="SUCCESS: 2 ERROR: 0 SKIPPED: 0" }={}) {
  const calls=[];
  return {
    calls,
    args: {
      execute: async commit => {
        calls.push(commit ? "commit" : "dry-run");
        return commit ? {status:commitStatus,output:commitOutput} : {status:dryStatus,output:dryOutput};
      },
      saveReport: async content => {calls.push("report");assert.equal(content,dryOutput);return "before-after.txt";},
      confirm: async () => {calls.push("confirm");return answer;},
      log: () => {}
    }
  };
}
test("N cancels after report without modifying Affinity", async () => {
  const h=harness({answer:"N"});
  assert.equal(await runWorkflow(h.args),0);
  assert.deepEqual(h.calls,["dry-run","report","confirm"]);
});
test("Y commits only after safe dry run and report", async () => {
  const h=harness();
  assert.equal(await runWorkflow(h.args),0);
  assert.deepEqual(h.calls,["dry-run","report","confirm","commit"]);
});
test("errors, skipped docs, and empty batch block confirmation", async () => {
  for (const dryOutput of ["SUCCESS: 1 ERROR: 1 SKIPPED: 0","SUCCESS: 1 ERROR: 0 SKIPPED: 1","SUCCESS: 0 ERROR: 0 SKIPPED: 0", "bad output"]) {
    const h=harness({dryOutput});
    assert.equal(await runWorkflow(h.args),1);
    assert.deepEqual(h.calls,["dry-run","report"]);
  }
});
test("failed dry run or failed commit returns error without further edits", async () => {
  const a=harness({dryStatus:1});
  assert.equal(await runWorkflow(a.args),1);
  assert.deepEqual(a.calls,["dry-run","report"]);
  const b=harness({commitStatus:1});
  assert.equal(await runWorkflow(b.args),1);
  assert.deepEqual(b.calls,["dry-run","report","confirm","commit"]);
});
test("mismatched commit count is rejected", async () => {
  const h=harness({commitOutput:"SUCCESS: 1 ERROR: 0 SKIPPED: 0"});
  assert.equal(await runWorkflow(h.args),1);
});
