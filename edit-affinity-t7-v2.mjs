// T7 V2: READ-ONLY invoice period reconciliation. Never modifies an Affinity document.
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const MARKER = "__PHONG_T7_V2_READ_ONLY_REPORT__";
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
    report.push({ title, status: "OK", campaigns: dates.length, periodStart, proposedDescription });
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
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, "t7-v2-reconciliation-" + stamp);
  const report = { ...payload, generatedAt: new Date().toISOString(), source: "Open Affinity documents (read-only)", note: "Independent reconciliation report; original invoice files and document text remain unchanged." };
  fs.writeFileSync(base + ".json", JSON.stringify(report, null, 2) + "\n", "utf8");
  const headers = ["title", "status", "campaigns", "periodStart", "proposedDescription", "reason"];
  fs.writeFileSync(base + ".csv", "\uFEFF" + headers.join(",") + "\r\n" + report.report.map(item => headers.map(k => csvCell(item[k])).join(",")).join("\r\n") + "\r\n", "utf8");
  for (const item of report.report) console.log(item.title + " [" + item.status + "] " + (item.proposedDescription || item.reason));
  console.log("READ ONLY: No invoice text changed; watermark is not required.");
  console.log("JSON: " + base + ".json\nCSV:  " + base + ".csv");
  if (report.report.some(x => x.status === "ERROR")) process.exitCode = 1;
}
main().catch(e => { console.error("T7 V2 ERROR:", e.stack || String(e)); process.exitCode = 1; });
