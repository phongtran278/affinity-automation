import { FIELD_STATE } from "../rules/field-policy.mjs";

export default {
  id: "prohomes-t9-2026",
  label: "ProHomes TKQC 1 - 09/2026",
  clientName: "phong-affinity-batch-t9",
  marker: "__PHONG_BATCH_T9__",
  serverUrl: "http://localhost:6767/sse",
  dataFile: "data/prohomes-t9-2026.json",

  stt: {
    min: 70,
    max: 111,
    expectedCount: 42
  },

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
    pattern: "^FBADS-179-\\d{9}$",
    documentPattern: "FBADS-179-\\d+",
    commitFailure: "WARNING"
  },

  periodDescription: {
    enabled: true,
    mode: "campaign-earliest-start"
  },

  campaign: {
    startOffsetDays: {
      base: 3,
      cycle: 4
    },
    naming: {
      base: [
        "Vinhomes Cần Giờ",
        "Vin Cần Giờ",
        "VinCG",
        "Vinhomes CG",
        "Green Paradise",
        "Vinhomes Green Paradise",
        "Green Paradise Cần Giờ"
      ],
      month: ["T9","T9 26","T9 2026","Tháng 9 2026","09.2026","T9/2026"],
      audience: [
        "Đầu tư","KH đầu tư","Nhà đầu tư","KH HCM","KH miền Nam","KH miền Bắc",
        "Lead mới","Remarketing","Retarget","KH 35+","KH 40+","Mua ở",
        "Mua ở + đầu tư","Quan tâm BĐS","Update"
      ],
      separator: [" - "," | "," / ","_"," ","  "]
    }
  },

  manualCommitFallback: {
    campaigns: {
      "75": [8]
    }
  },

  compatibility: {
    mergedTextNodes: true,
    separatedTextNodes: true,
    invoiceDateStandaloneFallback: true
  }
};
