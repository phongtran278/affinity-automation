import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

const SERVER_URL="http://localhost:6767/sse";
const DATA_PATH=path.join(__dirname,"data","prohomes-t7-2026.json");
const DRY_RUN=process.env.AFFINITY_COMMIT==="1" ? false : true;

function getTextContent(result){
  return (result?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}
function fail(msg){ throw new Error(msg); }
function pad2(n){ return String(n).padStart(2,"0"); }

function loadData(){
  const raw=JSON.parse(fs.readFileSync(DATA_PATH,"utf8"));
  if(!Array.isArray(raw.items)||raw.items.length!==42) fail("Source JSON phải có đúng 42 items.");
  const seen=new Set();
  for(const x of raw.items){
    if(!Number.isInteger(x.stt)||x.stt<1||x.stt>42) fail("STT không hợp lệ: "+x.stt);
    if(seen.has(x.stt)) fail("Duplicate STT: "+x.stt);
    seen.add(x.stt);
    if(!x.transactionId||!x.timestamp) fail("Thiếu ID/timestamp tại STT "+x.stt);
    for(const k of ["subtotal","vat","total"]){
      if(!Number.isInteger(x[k])||x[k]<0) fail("Money không hợp lệ "+k+" tại STT "+x.stt);
    }
    if(x.subtotal+x.vat!==x.total) fail("subtotal + VAT != total tại STT "+x.stt);
  }
  for(let i=1;i<=42;i++) if(!seen.has(i)) fail("Thiếu STT "+i);
  return raw;
}

async function main(){
  const source=loadData();
  const client=new Client({name:"phong-affinity-batch-t7",version:"1.0.0"});
  const transport=new SSEClientTransport(new URL(SERVER_URL));
  await client.connect(transport);

  // Affinity Script Manager requires the SDK preamble to be read before execute_script.
  await client.request(
    {
      method:"tools/call",
      params:{
        name:"read_sdk_documentation_topic",
        arguments:{filename:"preamble"}
      }
    },
    CallToolResultSchema
  );

  const payload=JSON.stringify({
    dryRun:DRY_RUN,
    batch:source.batch,
    items:source.items
  });

  const script=`
"use strict";
const { app } = require("/application");
const { Document } = require("/document");
const { Selection, TextSelection } = require("/selections");
const { StoryRange, StoryIoFormat } = require("affinity:story");
const { DocumentCommand } = require("/commands");

const CONFIG=${payload};

function toArray(c){
  if(!c) return [];
  try{ if(c.toArray) return c.toArray(); }catch(_){}
  try{ return Array.from(c); }catch(_){}
  return [];
}
function pad2(n){ return String(n).padStart(2,"0"); }
function allTextNodes(doc){
  return toArray(doc.layers.all).filter(function(n){return n&&(n.isFrameTextNode||n.isArtTextNode);});
}
function getRawText(node){
  try{return node.getText(0,-1,StoryIoFormat.Raw);}catch(_){}
  try{return node.story?node.story.getText(0,-1):"";}catch(_){}
  return "";
}
function replaceRange(doc,node,begin,end,newText){
  const sel=Selection.create(doc,node);
  const textSel=TextSelection.create(new StoryRange(begin,end));
  sel.addSubSelectionForNode(node,textSel);
  doc.executeCommand(DocumentCommand.createSetText(sel,newText));
}
function getDocName(doc){
  try{return String(doc.name||"");}catch(_){}
  try{return String(doc.title||"");}catch(_){}
  return "";
}
function parseStt(doc){
  const name=getDocName(doc);
  let m=name.match(/^(\\d{1,2})\\s*-\\s*/);
  if(m) return Number(m[1]);
  const text=allTextNodes(doc).map(getRawText).join("\\n");
  m=text.match(/(?:^|\\n)\\s*(\\d{1,2})\\s*-\\s*/);
  return m?Number(m[1]):null;
}
function formatInvoiceDate(ts){
  const m=String(ts).match(/^(\\d{4})-(\\d{2})-(\\d{2})[ T](\\d{2}):(\\d{2})/);
  if(!m) throw new Error("Timestamp invalid: "+ts);
  return m[4]+":"+m[5]+" "+Number(m[3])+" tháng "+Number(m[2])+", "+m[1];
}
function moneyTokens(text){
  const re=/\\b\\d{1,3}(?:(?:[., \\u00A0]\\d{3})+|\\d*)\\s*(?:₫|VND)\\b/gi;
  const out=[]; let m;
  while((m=re.exec(text))) out.push({begin:m.index,end:m.index+m[0].length,text:m[0]});
  return out;
}
function normalizeMoney(s){
  const digits=String(s).replace(/[^0-9]/g,"");
  return digits?Number(digits):NaN;
}
function formatMoneyLike(oldText,value){
  const suffix=/VND/i.test(oldText)?" VND":(/₫/.test(oldText)?" ₫":"");
  const nbsp=oldText.includes("\\u00A0");
  const sep=oldText.includes(".")?".":(oldText.includes(",")?",":(nbsp?"\\u00A0":" "));
  const parts=String(value).replace(/\\B(?=(\\d{3})+(?!\\d))/g,sep);
  return parts+suffix;
}
function addExact(plan,node,text,oldText,newText,type,required){
  const indexes=[]; let from=0;
  while(true){
    const i=text.indexOf(oldText,from);
    if(i<0) break;
    indexes.push(i); from=i+oldText.length;
  }
  if(required&&indexes.length!==1) throw new Error(type+": expected 1 match, got "+indexes.length);
  if(indexes.length===1){
    plan.push({node,begin:indexes[0],end:indexes[0]+oldText.length,oldText,newText,type});
    return true;
  }
  return false;
}
function buildPlan(doc,row){
  const nodes=allTextNodes(doc);
  if(!nodes.length) throw new Error("Không có text node.");
  const plan=[];

  let idFound=false,dateFound=false;
  for(const node of nodes){
    const text=getRawText(node);
    if(!idFound){
      const m=text.match(/\\b\\d{10,}-\\d{10,}\\b/);
      if(m){
        plan.push({node,begin:m.index,end:m.index+m[0].length,oldText:m[0],newText:row.transactionId,type:"transactionId"});
        idFound=true;
      }
    }
    if(!dateFound){
      const m=text.match(/\\b\\d{1,2}:\\d{2}\\s+\\d{1,2}\\s+tháng\\s+\\d{1,2},\\s+\\d{4}\\b/);
      if(m){
        plan.push({node,begin:m.index,end:m.index+m[0].length,oldText:m[0],newText:formatInvoiceDate(row.timestamp),type:"invoiceDate"});
        dateFound=true;
      }
    }
  }
  if(!idFound) throw new Error("Không tìm thấy ID giao dịch.");
  if(!dateFound) throw new Error("Không tìm thấy ngày lập hóa đơn/thanh toán.");

  // Money: only touch values when a label and exactly one money token coexist in the same node.
  const moneyRules=[
    {labels:["Tổng phụ"],value:row.subtotal,type:"subtotal"},
    {labels:["VAT"],value:row.vat,type:"vat"},
    {labels:["Tổng thanh toán"],value:row.total,type:"total"},
    {labels:["Đã thanh toán"],value:row.total,type:"paid"}
  ];
  for(const rule of moneyRules){
    let hit=0;
    for(const node of nodes){
      const text=getRawText(node);
      if(!rule.labels.some(l=>text.includes(l))) continue;
      const toks=moneyTokens(text);
      if(toks.length===1){
        const t=toks[0];
        plan.push({node,begin:t.begin,end:t.end,oldText:t.text,newText:formatMoneyLike(t.text,rule.value),type:rule.type});
        hit++;
      }
    }
    if(hit>1) throw new Error(rule.type+": ambiguous money nodes ("+hit+")");
  }

  // Generic campaign/date/ad-group/impression mutation remains fail-safe: do not guess structure.
  // We still report discovery counts in dry-run/commit output.
  let campaignDateCandidates=0, impressionCandidates=0;
  for(const node of nodes){
    const text=getRawText(node);
    if(/Từ\\s+00:00[\\s\\S]*?đến\\s+\\d{1,2}:\\d{2}/i.test(text)) campaignDateCandidates++;
    if(/(?:Số lần hiển thị|Lượt hiển thị)/i.test(text)) impressionCandidates++;
  }

  return {plan,nodes,campaignDateCandidates,impressionCandidates};
}
function validatePlan(doc,plan){
  const byNode=new Map();
  for(const r of plan){
    const arr=byNode.get(r.node)||[]; arr.push(r); byNode.set(r.node,arr);
  }
  for(const [node,arr] of byNode){
    const current=getRawText(node);
    arr.sort((a,b)=>a.begin-b.begin);
    for(let i=0;i<arr.length;i++){
      const r=arr[i];
      if(current.slice(r.begin,r.end)!==r.oldText) throw new Error("stale range: "+r.type);
      if(i&&arr[i-1].end>r.begin) throw new Error("overlapping ranges");
    }
  }
}
function commitPlan(doc,plan){
  const groups=new Map();
  for(const r of plan){const arr=groups.get(r.node)||[];arr.push(r);groups.set(r.node,arr);}
  for(const [node,arr] of groups){
    arr.sort((a,b)=>b.begin-a.begin);
    for(const r of arr) replaceRange(doc,node,r.begin,r.end,r.newText);
  }
}

(function(){
  let docs=[];
  try{docs=toArray(Document.all);}catch(_){}
  if(!docs.length&&Document.current) docs=[Document.current];
  if(!docs.length) throw new Error("Không có document đang mở.");

  const rows={};
  CONFIG.items.forEach(function(x){rows[x.stt]=x;});

  const seen={};
  const report=[];
  let success=0,error=0,skipped=0;

  for(let i=0;i<docs.length;i++){
    const doc=docs[i];
    const name=getDocName(doc);
    let stt=null;
    try{stt=parseStt(doc);}catch(_){}
    if(!(stt>=1&&stt<=42)){skipped++;report.push({document:name,status:"SKIPPED",reason:"outside batch / no STT"});continue;}
    if(seen[stt]){error++;report.push({stt,status:"ERROR",reason:"duplicate STT",document:name});continue;}
    seen[stt]=true;

    try{
      const row=rows[stt];
      if(!row) throw new Error("Không có mapping source.");
      if(row.subtotal+row.vat!==row.total) throw new Error("subtotal + VAT != total");

      const built=buildPlan(doc,row);
      validatePlan(doc,built.plan);

      if(!CONFIG.dryRun) commitPlan(doc,built.plan);

      success++;
      report.push({
        stt,
        document:name,
        status:"OK",
        mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
        replacements:built.plan.map(function(r){return {type:r.type,old:r.oldText,new:r.newText};}),
        campaignDateCandidates:built.campaignDateCandidates,
        impressionCandidates:built.impressionCandidates
      });
    }catch(e){
      error++;
      report.push({stt,document:name,status:"ERROR",reason:e.message||String(e)});
    }
  }

  console.log("__PHONG_BATCH_T7__"+JSON.stringify({
    mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
    totalOpen:docs.length,
    success,error,skipped,report
  }));
})();
`;

  let result;
  try{
    result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);
  }finally{
    try{ await client.close(); }catch(_){}
  }

  const output=getTextContent(result);
  const marker="__PHONG_BATCH_T7__";
  const line=output.split(/\r?\n/).find(x=>x.includes(marker));
  if(!line) throw new Error("Affinity không trả batch report.\n"+output);

  const report=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
  console.log("\nBATCH 01-42 | "+report.mode);
  for(const r of report.report){
    const label=r.stt?("STT "+pad2(r.stt)):r.document;
    console.log(label+" ["+r.status+(r.reason?": "+r.reason:"")+"]");
  }
  console.log("\nSUCCESS: "+report.success+" ERROR: "+report.error+" SKIPPED: "+report.skipped);

  if(DRY_RUN){
    console.log("\nDRY_RUN=true: không có text nào được thay.");
    console.log("Để commit các field đã validate: set AFFINITY_COMMIT=1 rồi chạy lại.");
  }
}
main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
