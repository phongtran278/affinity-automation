// Preview-only runner on illustrative campaign ranges, not real invoices.
import { summarizeAdSpendPeriod } from "./modules/payment-summary/period-message.mjs";

const sample = [
  "Từ 00:00 3 tháng 10, 2026 đến 12:00 4 tháng 10, 2026",
  "Từ 00:00 1 tháng 10, 2026 đến 12:00 4 tháng 10, 2026",
  "Từ 00:00 30 tháng 9, 2026 đến 12:00 4 tháng 10, 2026",
  "Từ 00:00 2 tháng 10, 2026 đến 12:00 4 tháng 10, 2026"
];
const result=summarizeAdSpendPeriod(sample);
console.log(result.notice);
console.log("T7 V2 PREVIEW:", result.label);
console.log("Earliest campaign start:", result.startDate);
console.log("No Affinity files opened, edited, or saved.");
