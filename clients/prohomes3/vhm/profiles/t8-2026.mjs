import { FIELD_STATE } from "../../../../rules/field-policy.mjs";

export default {
  id: "prohomes3-vhm-t8-2026",
  label: "ProHomes3 VHM - 08/2026",
  clientName: "phong-affinity-prohomes3-vhm-t8",
  marker: "__PROHOMES3_VHM_T8__",
  serverUrl: "http://localhost:6767/sse",
  dataFile: "clients/prohomes3/vhm/data/t8-2026.json",
  stt: { min:37, max:73, expectedCount:35, expectedSourceCount:37, excluded:[63,66] },
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
      month:["T8","T8 26","T8 2026","Tháng 8 2026","08.2026","T8/2026"],
      audience:["Đầu tư","KH đầu tư","Nhà đầu tư","KH HCM","KH miền Nam","KH miền Bắc","Lead mới","Remarketing","Retarget","KH 35+","KH 40+","Mua ở","Mua ở + đầu tư","Quan tâm BĐS","Update"],
      separator:[" - "," | "," / ","_"," ","  "],
      maxLength:31,
      compactBase:"Vin Hóc Môn",
      compactMonth:"T8/2026"
    }
  },
  compatibility: { mergedTextNodes:true, separatedTextNodes:true, invoiceDateStandaloneFallback:true }
};
