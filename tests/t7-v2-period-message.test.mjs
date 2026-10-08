import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAdSpendPeriod } from "../modules/payment-summary/period-message.mjs";

const campaign = (day, month, year) =>
  "Từ 00:00 " + day + " tháng " + month + ", " + year + " đến 12:00 5 tháng 10, 2026";

test("T7 V2 selects earliest campaign date instead of first campaign date", () => {
  const result = summarizeAdSpendPeriod([
    campaign(3,10,2026),campaign(1,10,2026),campaign(30,9,2026),campaign(2,10,2026)
  ]);
  assert.equal(result.startDate, "2026-09-30");
  assert.equal(result.label, "Chi tiêu cho Quảng cáo kể từ 30 tháng 9, 2026.");
  assert.equal(result.status, "PREVIEW_ONLY");
});

test("T7 V2 does not invent a date for missing/invalid campaigns", () => {
  assert.throws(() => summarizeAdSpendPeriod([]), /At least one campaign/);
  assert.throws(() => summarizeAdSpendPeriod([campaign(31, 9, 2026)]), /Invalid/);
  assert.throws(() => summarizeAdSpendPeriod(["unknown"]), /Cannot identify/);
});

test("T7 V2 handles one valid campaign and ignores ordering", () => {
  const a=campaign(28,6,2026), b=campaign(30,6,2026);
  assert.equal(summarizeAdSpendPeriod([a,b]).startDate,"2026-06-28");
  assert.equal(summarizeAdSpendPeriod([b,a]).startDate,"2026-06-28");
});
