import test from "node:test";
import assert from "node:assert/strict";
import { renderPeriodLayoutPreview } from "../modules/payment-summary/layout-preview.mjs";

test("T7 V2 mockup shows period message at three widths and clear TEST warning", () => {
  const html=renderPeriodLayoutPreview([{title:"01 - TEST",startDate:"2026-06-27",campaignCount:5,message:"Chi tiêu cho Quảng cáo kể từ 27 tháng 6, 2026."}]);
  assert.match(html,/KHÔNG CÓ GIÁ TRỊ THANH TOÁN/);
  assert.match(html,/320px/);
  assert.match(html,/480px/);
  assert.match(html,/640px/);
  assert.match(html,/27 tháng 6, 2026/);
  assert.match(html,/không phải bản dựng chính xác/i);
});

test("T7 V2 mockup HTML escapes document titles and untrusted text", () => {
  const html=renderPeriodLayoutPreview([{title:'<script>alert("x")</script>',startDate:"2026-09-30",campaignCount:1,message:"<b>unsafe</b>"}]);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/<b>unsafe<\/b>/);
  assert.match(html,/&lt;script&gt;/);
});
