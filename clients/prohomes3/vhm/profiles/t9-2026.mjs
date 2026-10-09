import { FIELD_STATE } from "../../../../rules/field-policy.mjs";

export default {
  id: "prohomes3-vhm-t9-2026",
  label: "ProHomes3 VHM - 09/2026",
  clientName: "phong-affinity-prohomes3-vhm-t9",
  marker: "__PROHOMES3_VHM_T9__",
  serverUrl: "http://localhost:6767/sse",
  dataFile: "clients/prohomes3/vhm/data/t9-2026.json",
  stt: { min:74, max:118, expectedCount:45, expectedSourceCount:45, excluded:[] },
  fields: {
    transactionId: FIELD_STATE.REQUIRED,
    invoiceDate: FIELD_STATE.REQUIRED,
    paid: FIELD_STATE.REQUIRED,
    subtotal: FIELD_STATE.REQUIRED,
    vat: FIELD_STATE.REQUIRED,
    total: FIELD_STATE.OPTIONAL,
    paymentThreshold: FIELD_STATE.OPTIONAL,
    invoiceNumber: FIELD_STATE.REQUIRED,
    campaigns: FIELD_STATE.REQUIRED,
    impressions: FIELD_STATE.REQUIRED
  },
  invoiceNumber: {
    pattern: "^FBADS-542-\\d{9}$",
    documentPattern: "FBADS-542-\\d+",
    commitFailure: "WARNING"
  },
  periodDescription: { enabled:true, mode:"campaign-earliest-start" },
  campaign: {
    startOffsetDays: { base:3, cycle:4 },
    naming: {
      base:["Vin Hóc Môn","Vinhomes Hóc Môn","VHM"],
      month:["T9","T9 26","T9 2026","Tháng 9 2026","09.2026","T9/2026"],
      audience:["Đầu tư","KH đầu tư","Nhà đầu tư","KH HCM","KH miền Nam","KH miền Bắc","Lead mới","Remarketing","Retarget","KH 35+","KH 40+","Mua ở","Mua ở + đầu tư","Quan tâm BĐS","Update"],
      separator:[" - "," | "," / ","_"," ","  "],
      maxLength:31,
      compactBase:"Vin Hóc Môn",
      compactMonth:"T9/2026"
    }
  },
  compatibility: { mergedTextNodes:true, separatedTextNodes:true, invoiceDateStandaloneFallback:true }
};
