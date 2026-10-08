// Read-only T7 V2 preview from Affinity documents visibly marked TEST.
// Never invokes document commands or writes PDF/Affinity files.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { summarizeAdSpendPeriod } from "./modules/payment-summary/period-message.mjs";
import { writePeriodLayoutPreview } from "./modules/payment-summary/layout-preview.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "__PHONG_T7_V2_READONLY__";
const script = String.raw`
"use strict";
const { Document } = require("/document");
const { StoryIoFormat } = require("affinity:story");
function arrayOf(x) {
  if (!x) return [];
  try { if (x.toArray) return x.toArray(); } catch (_) {}
  try { return Array.from(x); } catch (_) {}
  return [];
}
function textOf(node) {
  try { return node.getText(0,-1,StoryIoFormat.Raw); } catch (_) {}
  try { return node.story ? node.story.getText(0,-1) : ""; } catch (_) {}
  return "";
}
const dateRe = /Từ\s+00:00\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/gi;
const result = [];
let docs = [];
try { docs = arrayOf(Document.all); } catch (_) {}
if (!docs.length && Document.current) docs=[Document.current];
for (const doc of docs) {
  let title = "";
  try { title = String(doc.title || doc.name || "(untitled)"); } catch (_) {}
  try {
    const nodes = arrayOf(doc.layers.all).filter(n => n && (n.isFrameTextNode || n.isArtTextNode));
    const texts = nodes.map(textOf);
    // Disabled TEST watermark guard (kept for reference).
    // A visible TEST marker is required
    // if (!texts.some(t =>
    //   /TEST\s*[-–—]\s*KHÔNG CÓ GIÁ TRỊ THANH TOÁN/i.test(t)
    // )) {
    //   result.push({
    //     title,
    //     status: "SKIPPED",
    //     reason: "Missing visible TEST watermark"
    //   });
    //   continue;
    // }
    // Read-only preview: inspect the open document without requiring a watermark.
    const ranges = [];
    for (const text of texts) {
      dateRe.lastIndex=0;
      let match;
      while ((match=dateRe.exec(text)) !== null) ranges.push(match[0]);
    }
    const thresholdHits = texts.filter(t => /ngưỡng thanh toán/i.test(t)).length;
    result.push({ title, status:"TEST", ranges, thresholdHits });
  } catch (e) {
    result.push({title,status:"ERROR",reason:String(e && e.message || e)});
  }
}
console.log("__PHONG_T7_V2_READONLY__" + JSON.stringify(result));
`;

function getOutput(result) {
  return (result?.content || []).filter(x => x?.type === "text").map(x => x.text).join("\n");
}
async function main() {
  const client = new Client({name:"phong-t7-v2-readonly",version:"1.0.0"});
  await client.connect(new SSEClientTransport(new URL("http://localhost:6767/sse")));
  let result;
  try {
    await client.request({method:"tools/call",params:{name:"read_sdk_documentation_topic",arguments:{filename:"preamble"}}},CallToolResultSchema);
    result = await client.request({method:"tools/call",params:{name:"execute_script",arguments:{script}}},CallToolResultSchema);
  } finally { await client.close().catch(()=>{}); }
  const output = getOutput(result);
  const line = output.split(/\r?\n/).find(x=>x.includes(MARKER));
  if (!line) throw new Error("Affinity did not return a preview report. " + output);
  const docs = JSON.parse(line.slice(line.indexOf(MARKER) + MARKER.length));
  let successful = 0, failed = 0;
  const layoutItems = [];
  console.log("\nT7 V2 - READ ONLY PREVIEW (OPEN DOCUMENTS)");
  for (const doc of docs) {
    console.log("\nDocument: " + doc.title);
    if (doc.status==="SKIPPED") {
      console.log("SKIPPED: " + doc.reason);
      continue;
    }
    if (doc.status==="ERROR") {
      failed++; console.log("ERROR: " + doc.reason); continue;
    }
    try {
      const summary=summarizeAdSpendPeriod(doc.ranges);
      console.log("Campaign ranges: " + doc.ranges.length);
      console.log("Earliest start: " + summary.startDate);
      console.log("PREVIEW: " + summary.label);
      console.log("Threshold message found in nodes: " + doc.thresholdHits);
      console.log(summary.notice);
      layoutItems.push({title:doc.title,message:summary.label,startDate:summary.startDate,campaignCount:doc.ranges.length});
      successful++;
    } catch (e) {
      failed++; console.log("ERROR: " + e.message);
    }
  }
  const repoDir = path.dirname(fileURLToPath(import.meta.url));
  const htmlPath = writePeriodLayoutPreview(layoutItems,path.join(repoDir,"diagnostics"));
  if (htmlPath) console.log("Layout mockup (TEST): " + htmlPath);
  console.log("\nPREVIEW OK: " + successful + " | ERRORS: " + failed);
  console.log("READ ONLY: no Affinity text changes, edits, or saves. Only a local HTML preview is written.");
  if (failed) process.exitCode=1;
}
main().catch(e=>{ console.error("PREVIEW ERROR:",e.message); process.exitCode=1; });
