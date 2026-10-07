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
    if(!x.transactionId||!x.timestamp||!x.invoiceNumber) fail("Thiếu ID/timestamp/invoiceNumber tại STT "+x.stt);
    if(!/^FBADS-179-\d{9}$/.test(x.invoiceNumber)) fail("invoiceNumber không hợp lệ tại STT "+x.stt+": "+x.invoiceNumber);
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

  const script=String.raw`
"use strict";
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
function docIdentityCandidates(doc){
  const vals=[];
  const push=function(label,v){
    try{
      if(v===undefined||v===null) return;
      const s=String(v);
      if(s&&s!=="undefined"&&s!=="null") vals.push({label,value:s});
    }catch(_){}
  };
  try{push("name",doc.name);}catch(_){}
  try{push("title",doc.title);}catch(_){}
  try{push("path",doc.path);}catch(_){}
  try{push("filePath",doc.filePath);}catch(_){}
  try{push("sourcePath",doc.sourcePath);}catch(_){}
  try{push("sourceFilePath",doc.sourceFilePath);}catch(_){}
  try{push("uri",doc.uri);}catch(_){}
  try{
    if(doc.file){
      push("file",doc.file);
      push("file.path",doc.file.path);
      push("file.name",doc.file.name);
    }
  }catch(_){}
  return vals;
}
function getDocName(doc){
  const vals=docIdentityCandidates(doc);
  for(const x of vals) if(x.label==="title") return x.value;
  return vals.length?vals[0].value:"";
}
function parseStt(doc){
  const vals=docIdentityCandidates(doc);
  for(const x of vals){
    const normalized=String(x.value).replace(/\\\\/g,"/");
    const base=normalized.split("/").pop()||normalized;
    let m=base.match(/^(\d{1,2})\s*-\s*/);
    if(m) return {stt:Number(m[1]),source:x.label,value:x.value};
  }
  return {stt:null,source:null,value:null,identity:vals};
}
function timestampParts(ts){
  const m=String(ts).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if(!m) throw new Error("Timestamp invalid: "+ts);
  return {y:Number(m[1]),mo:Number(m[2]),d:Number(m[3]),hh:Number(m[4]),mm:Number(m[5])};
}
function formatInvoiceDate(ts){
  const p=timestampParts(ts);
  return pad2(p.hh)+":"+pad2(p.mm)+" "+p.d+" tháng "+p.mo+", "+p.y;
}
function campaignRange(ts,stt){
  const p=timestampParts(ts);
  const offset=3+((stt-1)%4);
  const ms=Date.UTC(p.y,p.mo-1,p.d)-offset*86400000;
  const s=new Date(ms);
  return "Từ 00:00 "+s.getUTCDate()+" tháng "+(s.getUTCMonth()+1)+", "+s.getUTCFullYear()+
    " đến "+pad2(p.hh)+":"+pad2(p.mm)+" "+p.d+" tháng "+p.mo+", "+p.y;
}
function moneyTokens(text){
  const re=/\d[\d., \u00A0]*\s*(?:₫|VND)/gi;
  const out=[]; let m;
  while((m=re.exec(text))) out.push({begin:m.index,end:m.index+m[0].length,text:m[0]});
  return out;
}
function moneyOnly(text){
  return /^\s*\d[\d., \u00A0]*\s*(?:₫|VND)\s*$/i.test(text);
}
function normalizeMoney(s){
  const digits=String(s).replace(/[^0-9]/g,"");
  return digits?Number(digits):NaN;
}
function formatMoneyLike(oldText,value){
  const suffix=/VND/i.test(oldText)?" VND":(/₫/.test(oldText)?" ₫":"");
  const nbsp=oldText.indexOf("\u00A0")>=0;
  const sep=oldText.indexOf(".")>=0?".":(oldText.indexOf(",")>=0?",":(nbsp?"\u00A0":" "));
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,sep)+suffix;
}
function parseImpression(text){
  const m=String(text).match(/^\s*([\d., \u00A0]+)\s+(Số lần hiển thị|Lượt hiển thị)\s*$/i);
  if(!m) return null;
  const n=Number(m[1].replace(/[^0-9]/g,""));
  return Number.isFinite(n)?{value:n,numText:m[1],label:m[2],begin:text.indexOf(m[1]),end:text.indexOf(m[1])+m[1].length}:null;
}
function formatIntegerLike(oldText,value){
  const nbsp=oldText.indexOf("\u00A0")>=0;
  const sep=oldText.indexOf(".")>=0?".":(oldText.indexOf(",")>=0?",":(oldText.indexOf(" ")>=0?" ":(nbsp?"\u00A0":".")));
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,sep);
}
function addPlan(plan,node,begin,end,oldText,newText,type,meta){
  if(oldText===newText) return;
  plan.push({node,begin,end,oldText,newText,type,meta:meta||null});
}
function replaceOnlyMoney(plan,node,text,value,type,meta){
  const toks=moneyTokens(text);
  if(toks.length!==1) throw new Error(type+": expected exactly 1 money token, got "+toks.length+" in ["+text+"]");
  const t=toks[0];
  addPlan(plan,node,t.begin,t.end,t.text,formatMoneyLike(t.text,value),type,meta);
}
function findExactLabel(texts,label){
  const hits=[];
  for(let i=0;i<texts.length;i++) if(texts[i].trim().toLowerCase()===label.toLowerCase()) hits.push(i);
  if(hits.length!==1) throw new Error('Label "'+label+'" expected 1, got '+hits.length);
  return hits[0];
}
function allocation(total,weights){
  const sum=weights.reduce((a,b)=>a+b,0);
  if(!(sum>0)) throw new Error("Allocation base <= 0");
  const out=[]; let used=0;
  for(let i=0;i<weights.length;i++){
    const v=i===weights.length-1 ? total-used : Math.round(total*weights[i]/sum);
    out.push(v); used+=v;
  }
  return out;
}
const NAME_BASE=["Vinhomes Cần Giờ","Vin Cần Giờ","VinCG","Vinhomes CG","Green Paradise","Vinhomes Green Paradise","Green Paradise Cần Giờ"];
const NAME_MONTH=["T7","T7 26","T7 2026","Tháng 7 2026","07.2026","T7/2026"];
const NAME_AUD=["Đầu tư","KH đầu tư","Nhà đầu tư","KH HCM","KH miền Nam","KH miền Bắc","Lead mới","Remarketing","Retarget","KH 35+","KH 40+","Mua ở","Mua ở + đầu tư","Quan tâm BĐS","Update"];
const NAME_SEP=[" - "," | "," / ","_"," ","  "];
function campaignName(stt,idx){
  const base=NAME_BASE[(stt*7+idx*3)%NAME_BASE.length];
  const month=NAME_MONTH[(stt*5+idx*2)%NAME_MONTH.length];
  const aud=NAME_AUD[(stt*11+idx*5)%NAME_AUD.length];
  const sep=NAME_SEP[(stt+idx)%NAME_SEP.length];
  const mode=(stt+idx)%4;
  if(mode===0) return base+sep+month;
  if(mode===1) return base+sep+month+sep+aud;
  if(mode===2) return base+" "+month+" "+aud;
  return base+sep+aud+sep+month;
}
function parseCampaigns(nodes,texts,existingSubtotal){
  const dateRe=/^Từ\s+00:00\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}$/i;
  const dates=[];
  for(let i=0;i<texts.length;i++) if(dateRe.test(texts[i].trim())) dates.push(i);
  if(!dates.length) throw new Error("Không tìm thấy campaign date range.");

  const campaigns=[];
  for(let ci=0;ci<dates.length;ci++){
    const d=dates[ci];
    const nameIdx=d-1;
    const amountIdx=d+1;
    if(nameIdx<0||amountIdx>=texts.length) throw new Error("Campaign structure out of bounds.");
    if(!moneyOnly(texts[amountIdx])) throw new Error("Campaign amount không nằm ngay sau date range tại node "+amountIdx);
    const oldSpend=normalizeMoney(texts[amountIdx]);
    if(!(oldSpend>0)) throw new Error("Campaign old spend <= 0 tại node "+amountIdx);

    const nextNameIdx=ci+1<dates.length ? dates[ci+1]-1 : texts.length;
    const groups=[];
    let k=amountIdx+1;
    while(k<nextNameIdx){
      const impIdx=k+1, spendIdx=k+2;

      // End of campaign section: footer/company text begins after the last ad group.
      if(spendIdx>=nextNameIdx) break;

      const imp=parseImpression(texts[impIdx]);
      const spendOk=moneyOnly(texts[spendIdx]);

      if(!imp || !spendOk){
        // For the final campaign, stop cleanly when we reach footer/legal text.
        if(ci===dates.length-1) break;

        // Before another campaign, structure must remain exact.
        throw new Error("Ad group structure không đúng tại nodes "+k+"/"+impIdx+"/"+spendIdx);
      }

      const oldGroupSpend=normalizeMoney(texts[spendIdx]);
      if(!(oldGroupSpend>0)) throw new Error("oldGroupSpend <= 0 tại node "+spendIdx);
      groups.push({nameIdx:k,impIdx,spendIdx,oldImpressions:imp.value,oldGroupSpend,imp});
      k+=3;
    }
    if(!groups.length) throw new Error("Campaign "+(ci+1)+" không có ad group.");
    const groupSum=groups.reduce((s,g)=>s+g.oldGroupSpend,0);
    if(groupSum!==oldSpend) throw new Error("Ad group sum mismatch campaign "+(ci+1)+": "+groupSum+" != "+oldSpend);
    campaigns.push({index:ci,nameIdx,dateIdx:d,amountIdx,oldSpend,groups});
  }
  const campaignSum=campaigns.reduce((s,x)=>s+x.oldSpend,0);
  if(campaignSum!==existingSubtotal) throw new Error("Campaign sum mismatch subtotal: "+campaignSum+" != "+existingSubtotal);
  return campaigns;
}
function buildPlan(doc,row,stt){
  const nodes=allTextNodes(doc);
  if(!nodes.length) throw new Error("Không có text node.");
  const texts=nodes.map(getRawText);
  const plan=[];

  let invoiceNumber=null;
  let invoiceNodeIndex=-1;
  let invoiceMatch=null;
  for(let i=0;i<texts.length;i++){
    const m=texts[i].match(/FBADS-179-\d+/i);
    if(m){
      if(invoiceNumber) throw new Error("Có nhiều hơn 1 invoice FBADS trong document.");
      invoiceNumber=m[0];
      invoiceNodeIndex=i;
      invoiceMatch={begin:m.index,end:m.index+m[0].length,text:m[0]};
    }
  }
  if(!invoiceNumber||invoiceNodeIndex<0||!invoiceMatch) throw new Error("Không tìm thấy Invoice # FBADS-179-xxxxxxxxx.");
  addPlan(plan,nodes[invoiceNodeIndex],invoiceMatch.begin,invoiceMatch.end,invoiceMatch.text,row.invoiceNumber,"invoiceNumber");

  const idLabel=findExactLabel(texts,"ID giao dịch");
  const idIdx=idLabel+1;
  if(idIdx>=texts.length || !/^\d{10,}-\d{10,}$/.test(texts[idIdx].trim())) throw new Error("Không tìm thấy ID giao dịch sau label.");
  addPlan(plan,nodes[idIdx],0,texts[idIdx].length,texts[idIdx],row.transactionId,"transactionId");

  const dateLabel=findExactLabel(texts,"Ngày lập hóa đơn/thanh toán");
  const dateIdx=dateLabel+1;
  if(dateIdx>=texts.length || !/^\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}$/.test(texts[dateIdx].trim())) throw new Error("Không tìm thấy invoice date sau label.");
  addPlan(plan,nodes[dateIdx],0,texts[dateIdx].length,texts[dateIdx],formatInvoiceDate(row.timestamp),"invoiceDate");

  const paidLabel=findExactLabel(texts,"Đã thanh toán");
  const paidIdx=paidLabel+1;
  if(paidIdx>=texts.length || !moneyOnly(texts[paidIdx])) throw new Error("Không tìm thấy tiền Đã thanh toán sau label.");
  replaceOnlyMoney(plan,nodes[paidIdx],texts[paidIdx],row.total,"paid");

  let subtotalIdx=-1,vatIdx=-1,totalIdx=-1;
  for(let i=0;i<texts.length;i++){
    if(/^Tổng phụ\s*:/i.test(texts[i])) subtotalIdx=i;
    if(/^VAT\s*:/i.test(texts[i])) vatIdx=i;
    if(/^Tổng thanh toán\s*:/i.test(texts[i])) totalIdx=i;
  }
  if(subtotalIdx<0) throw new Error("Không tìm thấy Tổng phụ.");
  if(vatIdx<0) throw new Error("Không tìm thấy VAT.");

  const oldSubtotalToken=moneyTokens(texts[subtotalIdx]);
  if(oldSubtotalToken.length!==1) throw new Error("Tổng phụ không có đúng 1 money token.");
  const existingSubtotal=normalizeMoney(oldSubtotalToken[0].text);
  if(!(existingSubtotal>0)) throw new Error("Existing subtotal <= 0.");

  replaceOnlyMoney(plan,nodes[subtotalIdx],texts[subtotalIdx],row.subtotal,"subtotal");
  replaceOnlyMoney(plan,nodes[vatIdx],texts[vatIdx],row.vat,"vat");
  if(totalIdx>=0) replaceOnlyMoney(plan,nodes[totalIdx],texts[totalIdx],row.total,"total");

  let thresholdHits=0;
  for(let i=0;i<texts.length;i++){
    const text=texts[i];
    if(/ngưỡng thanh toán/i.test(text)){
      const toks=moneyTokens(text);
      if(toks.length!==1) throw new Error("Ngưỡng thanh toán: expected exactly 1 money token, got "+toks.length);
      const t=toks[0];
      addPlan(plan,nodes[i],t.begin,t.end,t.text,formatMoneyLike(t.text,row.subtotal),"paymentThreshold");
      thresholdHits++;
    }
  }
  if(thresholdHits>1) throw new Error("Có nhiều hơn 1 field ngưỡng thanh toán.");

  const campaigns=parseCampaigns(nodes,texts,existingSubtotal);
  const newCampaignSpends=allocation(row.subtotal,campaigns.map(x=>x.oldSpend));
  const rangeText=campaignRange(row.timestamp,stt);
  let adGroupCount=0,impressionsUpdated=0;

  for(let ci=0;ci<campaigns.length;ci++){
    const camp=campaigns[ci];
    const newCampSpend=newCampaignSpends[ci];

    addPlan(plan,nodes[camp.nameIdx],0,texts[camp.nameIdx].length,texts[camp.nameIdx],campaignName(stt,ci),"campaignName",{campaign:ci+1});
    addPlan(plan,nodes[camp.dateIdx],0,texts[camp.dateIdx].length,texts[camp.dateIdx],rangeText,"campaignDate",{campaign:ci+1});
    replaceOnlyMoney(plan,nodes[camp.amountIdx],texts[camp.amountIdx],newCampSpend,"campaignSpend",{campaign:ci+1});

    const newGroupSpends=allocation(newCampSpend,camp.groups.map(g=>g.oldGroupSpend));
    for(let gi=0;gi<camp.groups.length;gi++){
      const g=camp.groups[gi];
      const ng=newGroupSpends[gi];
      const newImp=Math.max(1,Math.round(g.oldImpressions*ng/g.oldGroupSpend));
      const newImpText=formatIntegerLike(g.imp.numText,newImp);
      addPlan(plan,nodes[g.impIdx],g.imp.begin,g.imp.end,g.imp.numText,newImpText,"impressions",{campaign:ci+1,adGroup:gi+1});
      replaceOnlyMoney(plan,nodes[g.spendIdx],texts[g.spendIdx],ng,"adGroupSpend",{campaign:ci+1,adGroup:gi+1});
      adGroupCount++;
      if(newImp!==g.oldImpressions) impressionsUpdated++;
    }
  }

  const newCampaignSum=newCampaignSpends.reduce((a,b)=>a+b,0);
  if(newCampaignSum!==row.subtotal) throw new Error("New campaign sum mismatch subtotal.");
  for(let ci=0;ci<campaigns.length;ci++){
    const groupNew=allocation(newCampaignSpends[ci],campaigns[ci].groups.map(g=>g.oldGroupSpend));
    if(groupNew.reduce((a,b)=>a+b,0)!==newCampaignSpends[ci]) throw new Error("New ad group sum mismatch campaign "+(ci+1));
  }
  if(row.subtotal+row.vat!==row.total) throw new Error("subtotal + VAT != total");

  return {
    plan,nodes,
    campaigns:campaigns.length,
    adGroups:adGroupCount,
    impressionsUpdated,
    oldCampaignSum:campaigns.reduce((a,b)=>a+b.oldSpend,0),
    newCampaignSum,
    invoiceNumber
  };
}
function validatePlan(plan){
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
  for(const r of plan){
    const arr=groups.get(r.node)||[];
    arr.push(r);
    groups.set(r.node,arr);
  }

  let step=0;
  for(const [node,arr] of groups){
    arr.sort((a,b)=>b.begin-a.begin);
    for(const r of arr){
      step++;
      try{
        replaceRange(doc,node,r.begin,r.end,r.newText);
      }catch(e){
        const meta=r.meta
          ? " "+(r.meta.campaign?"C"+r.meta.campaign:"")+(r.meta.adGroup?"/G"+r.meta.adGroup:"")
          : "";
        return {
          ok:false,
          step:step,
          type:r.type,
          meta:meta,
          oldText:r.oldText,
          newText:r.newText,
          affinityMessage:(e&&e.message?e.message:String(e)),
          reason:
            "COMMAND_FAILED at step "+step+
            " | "+r.type+meta+
            " | ["+r.oldText+"] -> ["+r.newText+"]"+
            " | Affinity: "+(e&&e.message?e.message:String(e))
        };
      }
    }
  }
  return {ok:true};
}
function postValidate(plan){
  for(const r of plan){
    const text=getRawText(r.node);
    if(text.indexOf(r.newText)<0) throw new Error("Post-commit validation failed: "+r.type);
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
    let parsed={stt:null,identity:[]};
    try{parsed=parseStt(doc);}catch(_){}
    const stt=parsed.stt;

    if(!(stt>=1&&stt<=42)){
      skipped++;
      report.push({document:name,status:"SKIPPED",reason:"outside batch / no STT",identity:parsed.identity||[]});
      continue;
    }
    if(seen[stt]){
      error++;
      report.push({stt,status:"ERROR",reason:"duplicate STT",document:name});
      continue;
    }
    seen[stt]=true;

    try{
      const row=rows[stt];
      if(!row) throw new Error("Không có mapping source.");
      const built=buildPlan(doc,row,stt);
      validatePlan(built.plan);

      if(!CONFIG.dryRun){
        const commitResult=commitPlan(doc,built.plan);
        if(!commitResult.ok){
          error++;
          report.push({
            stt,document:name,status:"ERROR",
            reason:commitResult.reason,
            commitFailure:commitResult
          });
          continue;
        }
        postValidate(built.plan);
      }

      success++;
      report.push({
        stt,document:name,matchedBy:parsed.source,matchedValue:parsed.value,
        status:"OK",mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
        campaigns:built.campaigns,
        adGroups:built.adGroups,
        impressionsUpdated:built.impressionsUpdated,
        validation:"PASS",
        invoiceNumber:built.invoiceNumber,
        replacements:built.plan.map(function(r){
          return {type:r.type,old:r.oldText,new:r.newText,meta:r.meta||null};
        })
      });
    }catch(e){
      error++;
      report.push({stt,document:name,status:"ERROR",reason:e.message||String(e)});
    }
  }

  console.log("__PHONG_BATCH_T7__"+JSON.stringify({
    mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
    totalOpen:docs.length,success,error,skipped,report
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
    const label=r.stt?("STT "+pad2(r.stt)):(r.document||"(unnamed document)");
    console.log(label+" ["+r.status+(r.reason?": "+r.reason:"")+"]");
    if(r.status==="SKIPPED"&&Array.isArray(r.identity)&&r.identity.length){
      console.log("  identity: "+r.identity.map(x=>x.label+"="+x.value).join(" | "));
    }
    if(r.status==="OK"&&r.matchedBy){
      console.log("  matched by: "+r.matchedBy+" -> "+r.matchedValue);
      if(Array.isArray(r.replacements)){
        const byType={};
        for(const x of r.replacements){
          if(!byType[x.type]) byType[x.type]=[];
          byType[x.type].push(x);
        }

        const printOne=function(label,type){
          const arr=byType[type]||[];
          if(!arr.length){
            console.log("  "+label+": (không đổi / không có target)");
            return;
          }
          for(const x of arr){
            const meta=x.meta
              ? " ["+(x.meta.campaign?"C"+x.meta.campaign:"")+(x.meta.adGroup?"/G"+x.meta.adGroup:"")+"]"
              : "";
            console.log("  "+label+meta+": "+x.old+"  ->  "+x.new);
          }
        };

        console.log("  --- SO SÁNH GỐC -> SAU SỬA ---");
        printOne("ID giao dịch","transactionId");
        printOne("Ngày lập/thanh toán","invoiceDate");
        printOne("Đã thanh toán","paid");
        printOne("Tổng phụ","subtotal");
        printOne("VAT","vat");
        printOne("Tổng thanh toán","total");
        printOne("Ngưỡng thanh toán","paymentThreshold");

        printOne("Invoice #","invoiceNumber");

        printOne("Campaign name","campaignName");
        printOne("Campaign date","campaignDate");
        printOne("Campaign spend","campaignSpend");
        printOne("Ad group spend","adGroupSpend");
        printOne("Impressions","impressions");

        console.log("  campaigns: "+r.campaigns+" | ad groups: "+r.adGroups+" | impressions updated: "+r.impressionsUpdated);
        console.log("  validation: "+r.validation);
      }
    }
  }
  console.log("\nSUCCESS: "+report.success+" ERROR: "+report.error+" SKIPPED: "+report.skipped);

  if(DRY_RUN){
    console.log("\nDRY_RUN=true: không có text nào được thay.");
    console.log("Để commit các field đã validate: set AFFINITY_COMMIT=1 rồi chạy lại.");
  }

  if(report.error>0){
    throw new Error("Batch có "+report.error+" document lỗi. Xem chi tiết COMMAND_FAILED phía trên.");
  }
}
main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
