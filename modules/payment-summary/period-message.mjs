// T7 V2: derive a preview label from campaign date ranges.
// This module does not alter Affinity documents or financial records.
const CAMPAIGN_START = /Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})\s+đến\b/i;

function parseStart(range) {
  if (typeof range !== "string") throw new Error("Campaign date range must be text.");
  const match = CAMPAIGN_START.exec(range);
  if (!match) throw new Error("Cannot identify campaign start date: " + range);
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error("Invalid campaign start date: " + range);
  }
  return date;
}

export function summarizeAdSpendPeriod(campaignRanges) {
  if (!Array.isArray(campaignRanges) || campaignRanges.length === 0) {
    throw new Error("At least one campaign is required.");
  }
  const starts = campaignRanges.map(parseStart);
  const earliest = new Date(Math.min(...starts.map(d => d.getTime())));
  const day = earliest.getUTCDate(), month = earliest.getUTCMonth() + 1, year = earliest.getUTCFullYear();
  return {
    startDate: [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-"),
    label: "Chi tiêu cho Quảng cáo kể từ " + day + " tháng " + month + ", " + year + ".",
    status: "PREVIEW_ONLY",
    notice: "TEST — KHÔNG CÓ GIÁ TRỊ THANH TOÁN"
  };
}
