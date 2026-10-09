import test from "node:test";
import assert from "node:assert/strict";
import { parseBatchSummary, runWorkflow } from "../run-t7-v2-workflow.mjs";

test("parses the last Affinity batch summary", () => {
  assert.deepEqual(parseBatchSummary("SUCCESS: 1 ERROR: 0 SKIPPED: 0\nSUCCESS: 3 ERROR: 0 SKIPPED: 0"), {success:3,partial:0,error:0,skipped:0});
  assert.deepEqual(parseBatchSummary("SUCCESS: 2 PARTIAL: 1 ERROR: 0 SKIPPED: 0"), {success:2,partial:1,error:0,skipped:0});
  assert.throws(() => parseBatchSummary("no report"), /No valid batch summary/);
});
function harness({ dryStatus=0, dryOutput="SUCCESS: 2 PARTIAL: 0 ERROR: 0 SKIPPED: 0", answer="Y", commitStatus=0, commitOutput="SUCCESS: 2 PARTIAL: 0 ERROR: 0 SKIPPED: 0" }={}) {
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
  const h=harness({commitOutput:"SUCCESS: 1 PARTIAL: 0 ERROR: 0 SKIPPED: 0"});
  assert.equal(await runWorkflow(h.args),1);
});

test("partial dry run or commit is rejected", async () => {
  const dry=harness({dryOutput:"SUCCESS: 1 PARTIAL: 1 ERROR: 0 SKIPPED: 0"});
  assert.equal(await runWorkflow(dry.args),1);
  assert.deepEqual(dry.calls,["dry-run","report"]);

  const commit=harness({commitOutput:"SUCCESS: 1 PARTIAL: 1 ERROR: 0 SKIPPED: 0"});
  assert.equal(await runWorkflow(commit.args),1);
});

test("period-description behavior is profile-driven without an environment override", async () => {
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const workflow = fs.readFileSync(fileURLToPath(new URL("../run-t7-v2-workflow.mjs", import.meta.url)), "utf8");
  const core = fs.readFileSync(fileURLToPath(new URL("../core/run-batch.mjs", import.meta.url)), "utf8");
  const profile = fs.readFileSync(fileURLToPath(new URL("../profiles/prohomes-t7.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(workflow, /T7_V2_PERIOD_EDIT/);
  assert.match(core, /editPeriodDescription:profile\.periodDescription\?\.enabled===true/);
  assert.match(profile, /periodDescription:\s*\{[\s\S]*?enabled:\s*true/);
  assert.match(core, /if\(CONFIG\.editPeriodDescription\)/);
  assert.match(core, /adSpendDescriptionSuffix/);
});

test("description match never consumes subsequent payment values in merged PDF nodes", async () => {
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const core = fs.readFileSync(fileURLToPath(new URL("../core/run-batch.mjs", import.meta.url)), "utf8");
  const match = core.match(/const existingRe=(\/.*?\/gi);/);
  assert.ok(match, "V2 description matcher not found");
  // Compile only the embedded regex literal, not the Affinity script.
  const expr = match[1];
  const lastSlash = expr.lastIndexOf("/");
  const pattern = new RegExp(expr.slice(1,lastSlash),expr.slice(lastSlash+1));
  const node = "Hệ thống đang tiến hành lập hóa đơn vì bạn đã đạt đến ngưỡng thanh toán của mình.\\nNgưỡng thanh toán 4.000.000 ₫\\nTổng phụ: 4.000.000 ₫";
  const found = node.match(pattern);
  assert.equal(found?.length,1);
  assert.equal(found[0],"Hệ thống đang tiến hành lập hóa đơn vì bạn đã đạt đến ngưỡng thanh toán của mình.");
  assert.doesNotMatch(found[0], /4\.000\.000/);
  const prefix = "Hệ thống đang tiến hành lập hóa đơn vì bạn đã đạt đến ngưỡng thanh toán";
  assert.equal(prefix.match(pattern)?.[0], prefix);
  const withNewline = prefix + "\\nNgưỡng thanh toán 4.000.000 ₫";
  assert.equal(withNewline.match(pattern)?.[0], prefix);
  const split = "Hệ thống đang tiến hành lập hóa đơn vì bạn đã đạt đến ngưỡng thanh toán của";
  assert.equal(split.match(pattern)?.[0], split);
});

test("period description consumes its trailing amount and split cua minh text", async () => {
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const core = fs.readFileSync(fileURLToPath(new URL("../core/run-batch.mjs", import.meta.url)), "utf8");
  const match = core.match(/const tailRe=(\/.*?\/i);/);
  assert.ok(match);
  const literal = match[1], index=literal.lastIndexOf("/");
  const re = new RegExp(literal.slice(1,index),literal.slice(index+1));
  const tail = " 19.545.455 đ của";
  assert.equal(tail.match(re)?.[0],tail);
  assert.match(core,/for\(const suffix of hit\.suffixes\|\|\[\]\)/);
  assert.match(core,/adSpendDescriptionSuffix/);
  assert.match(core,/if\(hasMoney\|\|hasCua\) source\+=tail/);
  assert.equal(" \nTổng phụ: 19.545.455 ₫".match(re)?.[0]," ");
});

test("threshold money nested inside replaced description is skipped, standalone threshold remains", async () => {
  const fs=await import("node:fs");
  const {fileURLToPath}=await import("node:url");
  const core=fs.readFileSync(fileURLToPath(new URL("../core/run-batch.mjs",import.meta.url)),"utf8");
  assert.match(core,/const insideDescription=CONFIG\.editPeriodDescription && plan\.some/);
  assert.match(core,/t\.begin>=r\.begin && t\.end<=r\.end/);
  assert.match(core,/if\(insideDescription\) continue/);
  const description={node:"shared",type:"adSpendDescription",begin:0,end:88};
  const within={begin:72,end:84};
  const outside={begin:90,end:102};
  const covered=t=>description.node==="shared"&&t.begin>=description.begin&&t.end<=description.end;
  assert.equal(covered(within),true);
  assert.equal(covered(outside),false);
});

test("V2 description uses minimum start date of the campaign ranges after editing", async () => {
  const fs=await import("node:fs");
  const {fileURLToPath}=await import("node:url");
  const core=fs.readFileSync(fileURLToPath(new URL("../core/run-batch.mjs",import.meta.url)),"utf8");
  assert.match(core,/const proposedRanges=starts\.map\(function\(\)\{return campaignRange\(row\.timestamp,stt\);\}\)/);
  assert.match(core,/const earliest=new Date\(Math\.min\(\.\.\.finalStarts\)\)/);
  assert.match(core,/const rangeText=campaignRange\(row\.timestamp,stt\)/);
  // Same campaign-date formatting must drive both the replacement and the headline.
  const range="Từ 00:00 11 tháng 7, 2026 đến 23:59 14 tháng 7, 2026";
  const m=range.match(/^Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})/i);
  assert.equal(m[1],"11");
  assert.equal(m[2],"7");
  assert.equal(m[3],"2026");
});
