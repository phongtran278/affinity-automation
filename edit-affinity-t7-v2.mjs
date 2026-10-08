// T7 V2: READ-ONLY invoice period reconciliation. Never modifies an Affinity document.
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const MARKER = "__PHONG_T7_V2_READ_ONLY_REPORT__";
const SOURCE = JSON.parse(fs.readFileSync(new URL("./data/prohomes-t7-2026.json", import.meta.url), "utf8"));
const EXPECTED = new Map(SOURCE.items.map(x => [Number(x.stt), x]));
const embedded = String.raw`
"use strict";
const { Document } = require("/document");
const { StoryIoFormat } = require("affinity:story");
const MARKER = "__PHONG_T7_V2_READ_ONLY_REPORT__";
const dateRe = /Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/gi;
function asArray(x) {
  if (!x) return [];
  try { if (x.toArray) return x.toArray(); } catch (_) {}
  try { return Array.from(x); } catch (_) {}
  return [];
}
function rawText(node) {
  try { return node.getText(0, -1, StoryIoFormat.Raw); } catch (_) {}
  try { return node.story ? node.story.getText(0, -1) : ""; } catch (_) {}
  return "";
}
function parseDate(day, month, year) {
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (d.getUTCDate() !== Number(day) || d.getUTCMonth() + 1 !== Number(month) || d.getUTCFullYear() !== Number(year))
    throw new Error("Invalid campaign date.");
  return d.getTime();
}
let docs = [];
try { docs = asArray(Document.all); } catch (_) {}
if (!docs.length && Document.current) docs = [Document.current];
const report = [];
for (const doc of docs) {
  const title = String(doc.title || doc.name || "(untitled)");
  try {
    const texts = asArray(doc.layers.all).filter(n => n && (n.isFrameTextNode || n.isArtTextNode)).map(rawText);
    const dates = [];
    const existing = [];
    const oldSentence = /Chi\\s+tiêu\\s+cho\\s+Quảng\\s+cáo\\s+kể\\s+từ\\s+\\d{1,2}\\s+tháng\\s+\\d{1,2},\\s+\\d{4}\\./gi;
    const threshold = /Hệ thống đang tiến hành lập hóa đơn vì bạn đã đạt đến ngưỡng thanh toán[^\\r\\n\\u2028\\u2029]*/gi;
    for (const t of texts) {
      oldSentence.lastIndex = 0; threshold.lastIndex = 0;
      existing.push(...(t.match(oldSentence) || []));
      existing.push(...(t.match(threshold) || []));
    }
    for (const t of texts) {
      dateRe.lastIndex = 0;
      let match;
      while ((match = dateRe.exec(t)) !== null)
        dates.push(parseDate(match[1], match[2], match[3]));
    }
    if (!dates.length) throw new Error("No campaign date ranges found.");
    const d = new Date(Math.min(...dates));
    const periodStart = d.toISOString().slice(0, 10);
    const proposedDescription = "Chi tiêu cho Quảng cáo kể từ " + d.getUTCDate() + " tháng " + (d.getUTCMonth() + 1) + ", " + d.getUTCFullYear() + ".";
    report.push({ title, status: "OK", campaigns: dates.length, periodStart, proposedDescription, originalText: existing.length === 1 ? existing[0] : null, originalMatches: existing.length, comparison: existing.length === 1 ? (existing[0] === proposedDescription ? "UNCHANGED" : "PROPOSED") : "REVIEW_REQUIRED" });
  } catch (e) {
    report.push({ title, status: "ERROR", reason: String(e && e.message || e) });
  }
}
if (!docs.length) report.push({ title: "(none)", status: "ERROR", reason: "No open Affinity documents." });
console.log(MARKER + JSON.stringify({ mode: "READ_ONLY", report }));
`;
function extractText(result) {
  return (result?.content || []).filter(x => x?.type === "text").map(x => x.text).join("\n");
}
function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}
async function main() {
  const client = new Client({ name: "phong-t7-v2-reconciliation", version: "1.1.0" });
  await client.connect(new SSEClientTransport(new URL("http://localhost:6767/sse")));
  let result;
  try {
    await client.request({ method: "tools/call", params: { name: "read_sdk_documentation_topic", arguments: { filename: "preamble" } } }, CallToolResultSchema);
    result = await client.request({ method: "tools/call", params: { name: "execute_script", arguments: { script: embedded } } }, CallToolResultSchema);
  } finally {
    await client.close().catch(() => {});
  }
  const output = extractText(result);
  const line = output.split(/\r?\n/).find(x => x.includes(MARKER));
  if (!line) throw new Error("Affinity did not return a readable report: " + output.slice(0, 500));
  const payload = JSON.parse(line.slice(line.indexOf(MARKER) + MARKER.length));
  const dir = path.resolve("reports");
  fs.mkdirSync(dir, { recursive: true });
  const snapshotPath = path.join(dir, "t7-v2-42-progress.json");
  const previous = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, "utf8")) : { items: [] };
  const byStt = new Map();
  for (const row of previous.items || []) {
    const expected = EXPECTED.get(Number(row.stt));
    if (expected && row.transactionId === expected.transactionId && row.status === "OK") byStt.set(Number(row.stt), row);
  }
  const unknown = [];
  const errors = [];
  for (const row of payload.report) {
    const hits = [...EXPECTED.values()].filter(x => row.title.includes(x.transactionId));
    if (hits.length !== 1) {
      unknown.push(row.title);
      continue;
    }
    const item = hits[0];
    if (row.status !== "OK") { errors.push({ stt: item.stt, title: row.title, reason: row.reason }); continue; }
    byStt.set(item.stt, { stt: item.stt, transactionId: item.transactionId, title: row.title, status: "OK", campaigns: row.campaigns, periodStart: row.periodStart, proposedDescription: row.proposedDescription, originalText: row.originalText, comparison: row.comparison });
  }
  const items = [...byStt.values()].sort((a,b) => a.stt - b.stt);
  const missing = [...EXPECTED.keys()].filter(n => !byStt.has(n)).sort((a,b)=>a-b);
  const complete = missing.length === 0;
  const aggregate = { mode: "READ_ONLY", expected: EXPECTED.size, collected: items.length, complete, missing, unknown, errors, items, updatedAt: new Date().toISOString(), note: "Separate reconciliation report. No source invoice modified." };
  fs.writeFileSync(snapshotPath, JSON.stringify(aggregate, null, 2) + "\n", "utf8");
  const aggregateHeaders = ["stt", "transactionId", "title", "status", "campaigns", "periodStart", "proposedDescription", "originalText", "comparison"];
  fs.writeFileSync(path.join(dir,"t7-v2-42-progress.csv"), "\uFEFF" + aggregateHeaders.join(",") + "\r\n" + items.map(item => aggregateHeaders.map(k => csvCell(item[k])).join(",")).join("\r\n") + "\r\n", "utf8");

  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, "t7-v2-reconciliation-" + stamp);
  const report = { ...payload, generatedAt: new Date().toISOString(), source: "Open Affinity documents (read-only)", note: "Independent reconciliation report; original invoice files and document text remain unchanged." };
  fs.writeFileSync(base + ".json", JSON.stringify(report, null, 2) + "\n", "utf8");
  const headers = ["title", "status", "campaigns", "periodStart", "proposedDescription", "originalText", "comparison", "reason"];
  fs.writeFileSync(base + ".csv", "\uFEFF" + headers.join(",") + "\r\n" + report.report.map(item => headers.map(k => csvCell(item[k])).join(",")).join("\r\n") + "\r\n", "utf8");
  console.log("42-DOCUMENT PROGRESS: " + items.length + "/" + EXPECTED.size + " | " + (complete ? "COMPLETE" : "INCOMPLETE"));
  if (missing.length) console.log("Missing STT: " + missing.join(", "));
  if (unknown.length) console.log("Unmatched open documents: " + unknown.join(" | "));
  console.log("Aggregate JSON: " + snapshotPath);
  console.log("Aggregate CSV:  " + path.join(dir, "t7-v2-42-progress.csv"));
  for (const item of report.report) {
    console.log("\\n" + item.title + " [" + item.status + "] " + (item.comparison || ""));
    if (item.status === "OK") {
      console.log("  BEFORE: " + (item.originalText ?? ("[Ambiguous or missing original; matches=" + item.originalMatches + "]")));
      console.log("  AFTER (PROPOSED): " + item.proposedDescription);
    } else console.log("  ERROR: " + item.reason);
  }
  console.log("READ ONLY: No invoice text changed; watermark is not required.");
  console.log("JSON: " + base + ".json\nCSV:  " + base + ".csv");
  if (errors.length || payload.report.some(x => x.status === "ERROR")) process.exitCode = 1;
}
main().catch(e => { console.error("T7 V2 ERROR:", e.stack || String(e)); process.exitCode = 1; });
