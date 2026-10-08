// T7 V2: update only the existing ad-spend-period sentence in open Affinity documents.
// No invoice amounts, invoice IDs, campaign data, or source files are modified.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const COMMIT = process.env.AFFINITY_T7_V2_COMMIT === "1";
const MARKER = "__PHONG_T7_V2_PERIOD_EDIT__";
const script = String.raw`
"use strict";
const { Document } = require("/document");
const { Selection, TextSelection } = require("/selections");
const { StoryRange, StoryIoFormat } = require("affinity:story");
const { DocumentCommand } = require("/commands");

const COMMIT = ${COMMIT};
const MARKER = "__PHONG_T7_V2_PERIOD_EDIT__";
const dateRe = /Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/gi;
const targetRe = /Chi\s+tiêu\s+cho\s+Quảng\s+cáo\s+kể\s+từ\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\./gi;
function arrayOf(x) {
  if (!x) return [];
  try { if (x.toArray) return x.toArray(); } catch (_) {}
  try { return Array.from(x); } catch (_) {}
  return [];
}
function rawText(node) {
  try { return node.getText(0,-1,StoryIoFormat.Raw); } catch (_) {}
  try { return node.story ? node.story.getText(0,-1) : ""; } catch (_) {}
  return "";
}
function dateStart(text) {
  const m = /^Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})\s+đến/i.exec(text);
  if (!m) throw new Error("Invalid campaign date range.");
  const day=Number(m[1]), month=Number(m[2]), year=Number(m[3]);
  const d = new Date(Date.UTC(year,month-1,day));
  if (d.getUTCFullYear()!==year || d.getUTCMonth()+1!==month || d.getUTCDate()!==day) {
    throw new Error("Invalid campaign start date.");
  }
  return d.getTime();
}
function planFor(doc) {
  const title=String(doc.title || doc.name || "(untitled)");
  const nodes=arrayOf(doc.layers.all).filter(n=>n&&(n.isFrameTextNode||n.isArtTextNode));
  const texts=nodes.map(rawText);
  const dates=[], targets=[];
  for(let i=0;i<texts.length;i++){
    const text=texts[i];
    dateRe.lastIndex=0;
    let m;
    while((m=dateRe.exec(text))!==null) dates.push(dateStart(m[0]));
    targetRe.lastIndex=0;
    while((m=targetRe.exec(text))!==null)
      targets.push({node:nodes[i],begin:m.index,end:m.index+m[0].length,old:m[0]});
  }
  if(!dates.length) throw new Error("No campaign date ranges found.");
  if(targets.length!==1) {
    // Diagnostic only: never guess where to write when the target is missing or ambiguous.
    // Show only relevant text snippets rather than dumping the entire invoice.
    const hints=[];
    for(let i=0;i<texts.length;i++){
      const text=String(texts[i]);
      if(/chi\s*tiêu|quảng\s*cáo|ngưỡng\s*thanh\s*toán/i.test(text)){
        hints.push({node:i,text:text.replace(/[\r\n\u2028\u2029]+/g," | ").slice(0,220)});
      }
    }
    const e=new Error("Expected exactly 1 existing ad-spend-period sentence, found "+targets.length+". No changes made.");
    if(!hints.length){
      const sample=new Set();
      for(let i=0;i<Math.min(texts.length,10);i++)sample.add(i);
      for(let i=0;i<texts.length;i++){
        dateRe.lastIndex=0;
        if(dateRe.test(texts[i])){
          for(let j=Math.max(0,i-3);j<=Math.min(texts.length-1,i+2);j++)sample.add(j);
          if(sample.size>=22)break;
        }
      }
      for(const i of sample){
        hints.push({node:i,text:String(texts[i]).replace(/[\r\n\u2028\u2029]+/g,' | ').slice(0,160)});
        if(hints.length>=22)break;
      }
    }
    // Inspect a bounded header/summary region for the first PDF only.
    // Redact amounts and long numeric identifiers in diagnostics.
    if(doc===docs[0]){
      const structure=[];
      for(let i=0;i<Math.min(texts.length,27);i++){
        const snippet=String(texts[i])
          .replace(/\b\d{9,}\b/g,"[ID]")
          .replace(/\d[\d., \u00A0]*\s*(?:₫|VND)/gi,"[AMOUNT]")
          .replace(/[\r\n\u2028\u2029]+/g," | ")
          .slice(0,130);
        structure.push({node:i,text:snippet});
      }
      e.structure=structure;
    }
    e.hints=hints.slice(0,22);
    throw e;
  }
  const d=new Date(Math.min(...dates));
  const next="Chi tiêu cho Quảng cáo kể từ "+d.getUTCDate()+" tháng "+(d.getUTCMonth()+1)+", "+d.getUTCFullYear()+".";
  const t=targets[0];
  if(rawText(t.node).slice(t.begin,t.end)!==t.old) throw new Error("Stale or ambiguous text selection.");
  return {title,dates:dates.length,target:t,newText:next,unchanged:t.old===next};
}
let docs=[];
try { docs=arrayOf(Document.all); } catch (_) {}
if(!docs.length && Document.current) docs=[Document.current];
const report=[],plans=[];
if(!docs.length) report.push({status:"ERROR",title:"(none)",reason:"No open Affinity documents."});
for(const doc of docs){
  try{
    const p=planFor(doc);
    plans.push({doc,p});
    report.push({title:p.title,status:p.unchanged?"UNCHANGED":"READY",campaigns:p.dates,old:p.target.old,newText:p.newText});
  }catch(e){
    report.push({title:String(doc.title || doc.name || "(untitled)"),status:"ERROR",reason:String(e&&e.message||e),hints:e&&e.hints||[],structure:e&&e.structure||[]});
  }
}
const blocked=report.some(r=>r.status==="ERROR");
if(COMMIT && !blocked){
  for(const {doc,p} of plans){
    if(p.unchanged)continue;
    const r=report.find(x=>x.title===p.title&&x.status==="READY");
    try{
      if(rawText(p.target.node).slice(p.target.begin,p.target.end)!==p.target.old)
        throw new Error("Text changed since validation.");
      const sel=Selection.create(doc,p.target.node);
      sel.addSubSelectionForNode(p.target.node,TextSelection.create(new StoryRange(p.target.begin,p.target.end)));
      doc.executeCommand(DocumentCommand.createSetText(sel,p.newText));
      if(!rawText(p.target.node).includes(p.newText)) throw new Error("Post-commit validation failed.");
      if(r)r.status="UPDATED";
    }catch(e){
      if(r){r.status="ERROR";r.reason=String(e&&e.message||e);}
      break; // Stop on first commit failure; earlier changes may remain in memory.
    }
  }
}
console.log(MARKER+JSON.stringify({mode:COMMIT?"COMMIT":"DRY RUN",blocked,report}));
`;
function getOutput(result){
  return (result?.content||[]).filter(x=>x?.type==="text").map(x=>x.text).join("\n");
}
async function main(){
  const client=new Client({name:"phong-t7-v2-period-editor",version:"1.0.0"});
  await client.connect(new SSEClientTransport(new URL("http://localhost:6767/sse")));
  let result;
  try{
    await client.request({method:"tools/call",params:{name:"read_sdk_documentation_topic",arguments:{filename:"preamble"}}},CallToolResultSchema);
    result=await client.request({method:"tools/call",params:{name:"execute_script",arguments:{script}}},CallToolResultSchema);
  }finally{await client.close().catch(()=>{});}
  const output=getOutput(result);
  const line=output.split(/\r?\n/).find(x=>x.includes(MARKER));
  if(!line)throw new Error("Affinity did not return a report. "+output);
  const report=JSON.parse(line.slice(line.indexOf(MARKER)+MARKER.length));
  console.log("\nT7 V2 - "+report.mode+" (AD SPEND PERIOD ONLY)");
  for(const x of report.report){
    console.log("\n"+x.title+" ["+x.status+"]");
    if(x.reason)console.log("  ERROR: "+x.reason);
    if(x.hints?.length) { console.log("  Nearby text nodes (diagnostic, no edit):"); for(const h of x.hints)console.log("    node "+h.node+": "+h.text); }
    if(x.structure?.length){ console.log("  FIRST DOCUMENT HEADER STRUCTURE (IDs/amounts redacted):"); for(const n of x.structure)console.log("    node "+n.node+": "+n.text); }
    if(x.old!==undefined){
      console.log("  Campaigns: "+x.campaigns);
      console.log("  Before: "+x.old);
      console.log("  After:  "+x.newText);
    }
  }
  const errors=report.report.filter(x=>x.status==="ERROR").length;
  console.log("\nERRORS: "+errors+" | DOCS: "+report.report.length);
  if(!COMMIT)console.log("DRY RUN: No document text was changed.");
  else console.log("COMMIT: Updated text remains in Affinity memory; save the documents manually.");
  if(errors||report.blocked)process.exitCode=1;
}
main().catch(e=>{console.error("T7 V2 ERROR:",e.stack||e.message||String(e));process.exitCode=1;});
