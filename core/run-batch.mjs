import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { checkAmounts } from "./amout-engine.mjs";

function getTextContent(result){
  return (result?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}
function pad2(n){ return String(n).padStart(2,"0"); }

export async function runBatch(profile, source){
  const DRY_RUN=process.env.AFFINITY_COMMIT==="1" ? false : true;
  const client=new Client({name:profile.clientName,version:"2.0.0"});
  const transport=new SSEClientTransport(new URL(profile.serverUrl));
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
    editPeriodDescription:profile.periodDescription?.enabled===true,
    batch:source.batch,
    items:source.items,
    profile
  });

  const script=String.raw`
"use strict";
const { Document } = require("/document");
const { Selection, TextSelection } = require("/selections");
const { StoryRange, StoryIoFormat } = require("affinity:story");
const { ParagraphAlignXType, StoryDelta } = require("/storydelta");
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
function ensureNodeSpread(doc,node){
  let spread=null;
  try{spread=node.spread||null;}catch(_){}
  if(!spread) return;
  let same=false;
  try{same=!!(doc.currentSpread&&doc.currentSpread.isSameNode(spread));}catch(_){}
  if(!same) doc.executeCommand(DocumentCommand.createSetCurrentSpread(spread));
}
function replaceRange(doc,node,begin,end,newText){
  // Affinity selections are spread-sensitive. Switch to the node's spread
  // before creating the text selection.
  ensureNodeSpread(doc,node);
  const sel=Selection.create(doc,node);
  const textSel=TextSelection.create(new StoryRange(begin,end));
  sel.addSubSelectionForNode(node,textSel);
  doc.executeCommand(DocumentCommand.createSetText(sel,newText));
}
function forceLeftAlignment(doc,node){
  ensureNodeSpread(doc,node);
  const sel=Selection.create(doc,node);
  doc.executeCommand(
    DocumentCommand.createFormatText(
      sel,
      StoryDelta.createAlignX(ParagraphAlignXType.Left)
    )
  );
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
    let m=base.match(/^(\d+)\s*-\s*/);
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
  const offset=CONFIG.profile.campaign.startOffsetDays.base+
    ((stt-1)%CONFIG.profile.campaign.startOffsetDays.cycle);
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
function firstMoneyAfterLabel(text,labelRe){
  const lm=String(text).match(labelRe);
  if(!lm) return null;
  const start=lm.index+lm[0].length;
  const toks=moneyTokens(String(text).slice(start));
  if(!toks.length) return null;
  const t=toks[0];
  return {begin:start+t.begin,end:start+t.end,text:t.text};
}
function paragraphNameRangeBefore(text,end){
  let e=end;
  while(e>0 && /[\s\u2028\u2029]/.test(text[e-1])) e--;
  let s=e;
  while(s>0 && !/[\r\n\u2028\u2029]/.test(text[s-1])) s--;
  return {begin:s,end:e,text:text.slice(s,e)};
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
const NAME_BASE=CONFIG.profile.campaign.naming.base;
const NAME_MONTH=CONFIG.profile.campaign.naming.month;
const NAME_AUD=CONFIG.profile.campaign.naming.audience;
const NAME_SEP=CONFIG.profile.campaign.naming.separator;
function campaignName(stt,idx){
  const base=NAME_BASE[(stt*7+idx*3)%NAME_BASE.length];
  const month=NAME_MONTH[(stt*5+idx*2)%NAME_MONTH.length];
  const aud=NAME_AUD[(stt*11+idx*5)%NAME_AUD.length];
  const sep=NAME_SEP[(stt+idx)%NAME_SEP.length];
  const mode=(stt+idx)%4;

  let original;
  if(mode===0) original=base+sep+month;
  else if(mode===1) original=base+sep+month+sep+aud;
  else if(mode===2) original=base+" "+month+" "+aud;
  else original=base+sep+aud+sep+month;

  const naming=CONFIG.profile.campaign.naming||{};
  const maxLength=Number(naming.maxLength||0);
  if(!(maxLength>0) || Array.from(original).length<=maxLength) return original;

  // Never truncate a campaign name mid-word. If the deterministic variant is
  // too long, rebuild it from complete semantic phrases using profile-provided
  // compact equivalents.
  const compactBase=naming.compactBase||base;
  const compactMonth=naming.compactMonth||month;
  const hasAudience=mode!==0;
  const candidates=hasAudience
    ? [
        [base,compactMonth,aud].join(" "),
        [compactBase,compactMonth,aud].join(" "),
        [compactBase,month,aud].join(" "),
        [base,compactMonth].join(" "),
        [compactBase,compactMonth].join(" ")
      ]
    : [
        [base,compactMonth].join(" "),
        [compactBase,compactMonth].join(" "),
        [compactBase,month].join(" ")
      ];

  for(const candidate of candidates){
    const clean=candidate.replace(/\s+/g," ").trim();
    if(Array.from(clean).length<=maxLength) return clean;
  }

  throw new Error(
    "Không tạo được campaign name <= "+maxLength+
    " ký tự mà vẫn giữ nguyên cụm từ: "+original
  );
}
function parseCampaigns(nodes,texts,existingSubtotal){
  const dateRe=/Từ\s+00:00\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/i;
  const hits=[];
  for(let i=0;i<texts.length;i++){
    const m=texts[i].match(dateRe);
    if(m) hits.push({idx:i,begin:m.index,end:m.index+m[0].length,text:m[0]});
  }
  if(!hits.length) throw new Error("Không tìm thấy campaign date range.");

  const campaigns=[];
  for(let ci=0;ci<hits.length;ci++){
    const h=hits[ci];
    const d=h.idx;
    const mergedNameDate=texts[d].trim()!==h.text.trim();

    let nameIdx,nameBegin,nameEnd,nameText,startIdx;
    if(mergedNameDate){
      const nr=paragraphNameRangeBefore(texts[d],h.begin);
      if(!nr.text.trim()) throw new Error("Không tìm thấy campaign name trước date range tại node "+d);
      nameIdx=d;
      nameBegin=nr.begin;
      nameEnd=nr.end;
      nameText=nr.text;
      startIdx=d;
    }else{
      nameIdx=d-1;
      if(nameIdx<0) throw new Error("Campaign name out of bounds.");
      nameBegin=0;
      nameEnd=texts[nameIdx].length;
      nameText=texts[nameIdx];
      startIdx=nameIdx;
    }

    const amountIdx=d+1;
    if(amountIdx>=texts.length || !moneyOnly(texts[amountIdx])) throw new Error("Campaign amount không nằm ngay sau date range tại node "+amountIdx);
    const oldSpend=normalizeMoney(texts[amountIdx]);
    if(!(oldSpend>0)) throw new Error("Campaign old spend <= 0 tại node "+amountIdx);

    const nextStart=ci+1<hits.length
      ? (texts[hits[ci+1].idx].trim()!==hits[ci+1].text.trim() ? hits[ci+1].idx : hits[ci+1].idx-1)
      : texts.length;

    const groups=[];
    let k=amountIdx+1;
    while(k<nextStart){
      const impIdx=k+1, spendIdx=k+2;
      if(spendIdx>=nextStart) break;

      const imp=parseImpression(texts[impIdx]);
      const spendOk=moneyOnly(texts[spendIdx]);

      if(!imp || !spendOk){
        if(ci===hits.length-1) break;
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

    campaigns.push({
      index:ci,
      nameIdx,nameBegin,nameEnd,nameText,
      dateIdx:d,dateBegin:h.begin,dateEnd:h.end,dateText:h.text,
      amountIdx,oldSpend,groups,startIdx
    });
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

  let periodDescriptionStatus=CONFIG.editPeriodDescription?"OPTIONAL / NOT MATCHED":"DISABLED";
  // Profile-controlled: reconcile the existing ad-spend description against
  // the earliest campaign start date. Profiles opt in explicitly.
  if(CONFIG.editPeriodDescription){
    const campaignDateRe=/Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})\s+đến\s+\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/gi;
    const starts=[];
    for(const t of texts){
      campaignDateRe.lastIndex=0;
      let m;
      while((m=campaignDateRe.exec(t))){
        const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
        const dt=Date.UTC(year,month-1,day);
        const d=new Date(dt);
        if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)
          throw new Error("Invalid campaign start date");
        starts.push(dt);
      }
    }
    if(!starts.length) throw new Error("Không tìm thấy campaign date để cập nhật mô tả quảng cáo.");
    // All campaign dates are rewritten below. Derive the description from
    // the earliest START date of the resulting campaign ranges, not the
    // original imported ranges or the invoice date.
    const proposedRanges=starts.map(function(){return campaignRange(row.timestamp,stt);});
    const finalStarts=proposedRanges.map(function(range){
      const m=range.match(/^Từ\s+00:00\s+(\d{1,2})\s+tháng\s+(\d{1,2}),\s+(\d{4})/i);
      if(!m) throw new Error("Không đọc được ngày bắt đầu chiến dịch sau sửa.");
      const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
      const ms=Date.UTC(year,month-1,day),d=new Date(ms);
      if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)
        throw new Error("Ngày bắt đầu chiến dịch sau sửa không hợp lệ.");
      return ms;
    });
    const earliest=new Date(Math.min(...finalStarts));
    const desired="Chi tiêu cho Quảng cáo kể từ "+earliest.getUTCDate()+" tháng "+(earliest.getUTCMonth()+1)+", "+earliest.getUTCFullYear()+".";
    // Match the complete description, including an optional money tail and
    // "của mình." that Affinity may split into another text node.
    // Recognize known semantic variants, not just typography differences.
    const variants=[
      /Chi\s+tiêu\s+cho\s+Quảng\s+cáo\s+kể\s+từ\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\.?/.source,
      /(?:Chi\s+tiêu|Số\s+tiền\s+đã\s+chi)\s+cho\s+quảng\s+cáo\s+(?:kể\s+từ|từ)\s+(?:ngày\s+)?\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}\.?/.source,
      /Hệ\s+thống\s+đang\s+tiến\s+hành\s+lập\s+hóa\s+đơn\s+vì\s+bạn\s+đã\s+đạt\s+đến\s+ngưỡng\s+thanh\s+toán(?:\s+của\s+mình\.?)?/.source,
      /(?:Bạn\s+đã\s+đạt\s+(?:đến\s+)?ngưỡng\s+thanh\s+toán|Thanh\s+toán\s+do\s+đạt\s+ngưỡng\s+thanh\s+toán)\.?/.source,
      /Khoản\s+thanh\s+toán\s+thủ\s+công\s+đã\s+được\s+(?:yêu\s+cầu|thực\s+hiện)\s+trên\s+tài\s+khoản\s+này\.?/.source,
      /(?:Bạn\s+đã\s+thực\s+hiện|Đã\s+thực\s+hiện)\s+(?:một\s+)?(?:khoản\s+)?thanh\s+toán\s+thủ\s+công\.?/.source,
      /Bạn\s+đã\s+yêu\s+cầu\s+khoản\s+thanh\s+toán\s+thủ\s+công\s+này\.?/.source
    ];
    const existingRe=new RegExp(variants.join("|"),"gi");
    const tailRe=/^[ \t\u00a0]*(?:\d[\d., \u00a0]*[ \t\u00a0]*(?:₫|đ|VND)[ \t\u00a0]*)?(?:của[ \t\u00a0]*(?:mình\.)?)?/i;
    const hits=[];
    for(let i=0;i<texts.length;i++){
      existingRe.lastIndex=0;
      let m;
      while((m=existingRe.exec(texts[i]))){
        let old=m[0],source=m[0],suffixes=[];
        const rest=texts[i].slice(m.index+m[0].length);
        const tail=rest.match(tailRe)?.[0]||"";
        const hasMoney=/\d[\d., \u00a0]*[ \t\u00a0]*(?:₫|đ|VND)/i.test(tail);
        const hasCua=/\bcủa/i.test(tail);
        // Only remove a money suffix when it belongs to the description.
        if(hasMoney && !/\bcủa/i.test(tail)){
          throw new Error("Mô tả quảng cáo có tiền phía sau nhưng thiếu 'của'; cần kiểm tra text node.");
        }
        if(hasMoney||hasCua) source+=tail;
        if(/\bcủa[ \t\u00a0]*$/i.test(source.trim()) && i+1<texts.length &&
            /^[ \t\u00a0]*mình\.[ \t\u00a0]*$/i.test(texts[i+1])){
          old=source+" "+texts[i+1].trim();
          suffixes=[i+1];
        }else old=source;
        hits.push({i,begin:m.index,end:m.index+source.length,old,source,suffixes});
      }
    }

    // Affinity can split the same description into multiple adjacent text nodes.
    // Safe fallback: only accept a 2-3 node window when the ENTIRE joined text
    // matches one of the known descriptions.
    if(hits.length===0){
      const fullDescriptionRe=new RegExp("^(?:"+variants.join("|")+")(?:\\s+\\d[\\d., \\u00a0]*\\s*(?:₫|đ|VND))?(?:\\s+của\\s+mình\\.?)?$","i");
      for(let i=0;i<texts.length;i++){
        for(let span=2;span<=3 && i+span<=texts.length;span++){
          const parts=[];
          for(let j=0;j<span;j++) parts.push(texts[i+j].trim());
          const joined=parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
          if(!joined || !fullDescriptionRe.test(joined)) continue;

          const first=texts[i];
          const begin=first.search(/\S/);
          const end=first.replace(/\s+$/,"").length;
          if(begin<0 || end<=begin) continue;

          const suffixes=[];
          for(let j=1;j<span;j++){
            if(texts[i+j].trim()) suffixes.push(i+j);
          }
          hits.push({
            i,
            begin,
            end,
            old:joined,
            source:first.slice(begin,end),
            suffixes
          });
        }
      }
    }

    // An imported PDF may omit this paragraph or render it in an unrecognized
    // variant. Do not guess which text to overwrite: leave the description
    // untouched, report it as optional, and continue validating required fields.
    // Multiple recognized positions remain an error (ambiguous replacement).
    if(hits.length>1) throw new Error("Mô tả quảng cáo có nhiều vị trí ("+hits.length+"); cần kiểm tra.");
    if(hits.length===1){
      periodDescriptionStatus="PRESENT";
      const hit=hits[0];
      for(const suffix of hit.suffixes||[]){
        addPlan(plan,nodes[suffix],0,texts[suffix].length,texts[suffix],"","adSpendDescriptionSuffix");
      }
      addPlan(plan,nodes[hit.i],hit.begin,hit.end,hit.source,desired,"adSpendDescription",{before:hit.old});
    }
  }

  let invoiceNumber=null;
  let invoiceNodeIndex=-1;
  let invoiceMatch=null;
  for(let i=0;i<texts.length;i++){
    const m=texts[i].match(new RegExp(CONFIG.profile.invoiceNumber.documentPattern,"i"));
    if(m){
      if(invoiceNumber) throw new Error("Có nhiều hơn 1 invoice FBADS trong document.");
      invoiceNumber=m[0];
      invoiceNodeIndex=i;
      invoiceMatch={begin:m.index,end:m.index+m[0].length,text:m[0]};
    }
  }
  if(!invoiceNumber||invoiceNodeIndex<0||!invoiceMatch) throw new Error("Không tìm thấy Invoice # FBADS-179-xxxxxxxxx.");
  addPlan(plan,nodes[invoiceNodeIndex],invoiceMatch.begin,invoiceMatch.end,invoiceMatch.text,row.invoiceNumber,"invoiceNumber");

  // Transaction ID: support both separate label/value nodes and merged text nodes.
  let idHit=null;
  for(let i=0;i<texts.length;i++){
    const m=texts[i].match(/\b\d{10,}-\d{10,}\b/);
    if(m){
      if(idHit) throw new Error("Có nhiều hơn 1 transaction ID trong document.");
      idHit={idx:i,begin:m.index,end:m.index+m[0].length,text:m[0]};
    }
  }
  if(!idHit) throw new Error("Không tìm thấy ID giao dịch.");
  addPlan(plan,nodes[idHit.idx],idHit.begin,idHit.end,idHit.text,row.transactionId,"transactionId");

  // Invoice date: anchor to the invoice-date label so campaign date ranges are ignored.
  let dateHit=null;
  const invoiceDateRe=/\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}/i;
  const dateLabelRe=/ngày lập hóa đơn\/thanh toán/i;
  const dateLabelHits=[];

  for(let i=0;i<texts.length;i++){
    if(dateLabelRe.test(texts[i])) dateLabelHits.push(i);
  }

  if(dateLabelHits.length===1){
    const li=dateLabelHits[0];

    // Case 1: label + value merged into the same text node.
    let m=texts[li].match(invoiceDateRe);
    if(m){
      dateHit={idx:li,begin:m.index,end:m.index+m[0].length,text:m[0]};
    }else{
      // Case 2: label and value are separate adjacent nodes.
      const ni=li+1;
      if(ni<texts.length){
        m=texts[ni].match(invoiceDateRe);
        if(m){
          dateHit={idx:ni,begin:m.index,end:m.index+m[0].length,text:m[0]};
        }
      }
    }
  }else if(dateLabelHits.length>1){
    throw new Error("Có nhiều hơn 1 label Ngày lập hóa đơn/thanh toán.");
  }

  // Fallback for machines where the label itself is lost during PDF import:
  // only accept a node whose ENTIRE trimmed text is the invoice timestamp.
  if(!dateHit){
    const exactDateRe=/^\d{1,2}:\d{2}\s+\d{1,2}\s+tháng\s+\d{1,2},\s+\d{4}$/i;
    const exactHits=[];
    for(let i=0;i<texts.length;i++){
      const t=texts[i].trim();
      if(exactDateRe.test(t)) exactHits.push({idx:i,text:t});
    }
    if(exactHits.length===1){
      const h=exactHits[0];
      const begin=texts[h.idx].indexOf(h.text);
      dateHit={idx:h.idx,begin:begin,end:begin+h.text.length,text:h.text};
    }else if(exactHits.length>1){
      throw new Error("Có nhiều hơn 1 standalone invoice date trong document.");
    }
  }

  if(!dateHit) throw new Error("Không tìm thấy invoice date.");
  addPlan(plan,nodes[dateHit.idx],dateHit.begin,dateHit.end,dateHit.text,formatInvoiceDate(row.timestamp),"invoiceDate");

  // Summary block supports both separate nodes and one merged PDF text node.
  let paidHandled=false;
  for(let i=0;i<texts.length;i++){
    const t=firstMoneyAfterLabel(texts[i],/đã thanh toán/i);
    if(t){
      addPlan(plan,nodes[i],t.begin,t.end,t.text,formatMoneyLike(t.text,row.total),"paid");
      paidHandled=true;
      break;
    }
  }
  if(!paidHandled){
    for(let i=0;i<texts.length-1;i++){
      if(texts[i].trim().toLowerCase()==="đã thanh toán" && moneyOnly(texts[i+1])){
        replaceOnlyMoney(plan,nodes[i+1],texts[i+1],row.total,"paid");
        paidHandled=true;
        break;
      }
    }
  }
  if(!paidHandled) throw new Error("Không tìm thấy tiền Đã thanh toán.");

  let subtotalHit=null,vatHit=null,totalHit=null;
  for(let i=0;i<texts.length;i++){
    if(!subtotalHit){
      const t=firstMoneyAfterLabel(texts[i],/tổng phụ\s*:/i);
      if(t) subtotalHit={idx:i,tok:t};
    }
    if(!vatHit){
      const t=firstMoneyAfterLabel(texts[i],/\bVAT\s*:/i);
      if(t) vatHit={idx:i,tok:t};
    }
    if(!totalHit){
      const t=firstMoneyAfterLabel(texts[i],/tổng thanh toán\s*:/i);
      if(t) totalHit={idx:i,tok:t};
    }
  }

  // Legacy separate-node fallback.
  if(!subtotalHit || !vatHit){
    for(let i=0;i<texts.length;i++){
      if(!subtotalHit && /^Tổng phụ\s*:/i.test(texts[i])){
        const toks=moneyTokens(texts[i]);
        if(toks.length===1) subtotalHit={idx:i,tok:toks[0]};
      }
      if(!vatHit && /^VAT\s*:/i.test(texts[i])){
        const toks=moneyTokens(texts[i]);
        if(toks.length===1) vatHit={idx:i,tok:toks[0]};
      }
    }
  }

  if(!subtotalHit) throw new Error("Không tìm thấy Tổng phụ.");
  if(!vatHit) throw new Error("Không tìm thấy VAT.");

  const existingSubtotal=normalizeMoney(subtotalHit.tok.text);
  if(!(existingSubtotal>0)) throw new Error("Existing subtotal <= 0.");
  const existingVat=normalizeMoney(vatHit.tok.text);
  const vatLabelText=texts[vatHit.idx];
  const declaredRateMatch=vatLabelText.match(/Thuế suất\s*:\s*([\d.,]+)\s*%/i);
  const declaredRate=declaredRateMatch?declaredRateMatch[1]+"%":null;
  const vatRateComparison={
    before:existingVat>=0?(100*existingVat/existingSubtotal):null,
    after:row.subtotal>0?(100*row.vat/row.subtotal):null,
    label:declaredRate
  };

  // VAT-rate text can be merged into the VAT node or imported as separate
  // label/value nodes. Match the labelled field, never an arbitrary "%" node.
  const vatRateTargets=[];
  const vatLabelRe=/Thuế\s*suất\s*:\s*([\d.,]+)(\s*)%/gi;
  const vatStandaloneRe=/^\s*([\d.,]+)\s*%\s*$/;
  const vatOnlyLabelRe=/^\s*Thuế\s*suất\s*:\s*$/i;
  for(let i=0;i<texts.length;i++){
    vatLabelRe.lastIndex=0;
    let m;
    while((m=vatLabelRe.exec(texts[i]))){
      const relative=m[0].indexOf(m[1]);
      const begin=m.index+relative;
      vatRateTargets.push({idx:i,begin,end:begin+m[1].length,old:m[1]});
    }
    if(vatOnlyLabelRe.test(texts[i])){
      const next=i+1;
      const value=next<texts.length?texts[next].match(vatStandaloneRe):null;
      if(!value) throw new Error("Thuế suất có label nhưng không tìm thấy giá trị % tại node "+i);
      const begin=texts[next].indexOf(value[1]);
      vatRateTargets.push({idx:next,begin,end:begin+value[1].length,old:value[1]});
    }
  }
  if(vatRateTargets.length>1) throw new Error("Có nhiều hơn 1 field Thuế suất.");
  // A labelled rate must be editable; don't claim success if its PDF layout is unsupported.
  if(!vatRateTargets.length && texts.some(t=>/Thuế\s*suất\s*:/i.test(t)))
    throw new Error("Có nhãn Thuế suất nhưng chưa nhận diện được percent.");
  if(vatRateTargets.length){
    const t=vatRateTargets[0];
    if(!(row.subtotal>0) || row.subtotal+row.vat!==row.total)
      throw new Error("VAT rate: invalid source amounts");
    const calculatedPercent=Math.round((100*row.vat/row.subtotal)*100)/100;
    const oldDecimal=(t.old.split(/[.,]/)[1]||"").length;
    const neededDecimal=Number.isInteger(calculatedPercent)?0:(Number.isInteger(calculatedPercent*10)?1:2);
    const decimal=Math.min(2,Math.max(oldDecimal,neededDecimal));
    const separator=t.old.includes(",")?",":".";
    const newRate=calculatedPercent.toFixed(decimal).replace(".",separator);
    addPlan(plan,nodes[t.idx],t.begin,t.end,t.old,newRate,"vatRate");
    vatRateComparison.label=t.old+"%";
  }

  addPlan(plan,nodes[subtotalHit.idx],subtotalHit.tok.begin,subtotalHit.tok.end,subtotalHit.tok.text,formatMoneyLike(subtotalHit.tok.text,row.subtotal),"subtotal");
  addPlan(plan,nodes[vatHit.idx],vatHit.tok.begin,vatHit.tok.end,vatHit.tok.text,formatMoneyLike(vatHit.tok.text,row.vat),"vat");
  if(totalHit){
    addPlan(plan,nodes[totalHit.idx],totalHit.tok.begin,totalHit.tok.end,totalHit.tok.text,formatMoneyLike(totalHit.tok.text,row.total),"total");
  }

  let thresholdHits=0;
  for(let i=0;i<texts.length;i++){
    const t=firstMoneyAfterLabel(texts[i],/ngưỡng thanh toán/i);
    if(t){
      // When period-description replacement is enabled, it can replace the entire
      // legacy invoice-threshold sentence. Do not also edit a money token inside it.
      const insideDescription=CONFIG.editPeriodDescription && plan.some(function(r){
        return r.node===nodes[i] && r.type==="adSpendDescription" &&
          t.begin>=r.begin && t.end<=r.end;
      });
      if(insideDescription) continue;
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

    addPlan(plan,nodes[camp.nameIdx],camp.nameBegin,camp.nameEnd,camp.nameText,campaignName(stt,ci),"campaignName",{campaign:ci+1});
    addPlan(plan,nodes[camp.dateIdx],camp.dateBegin,camp.dateEnd,camp.dateText,rangeText,"campaignDate",{campaign:ci+1});
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

  // PDF import can preserve different paragraph alignment metadata on
  // different machines. Normalize only semantic name fields; do not touch
  // dates, impressions, or monetary columns.
  const alignmentTargets=[];
  const alignmentSeen=new Set();
  const addAlignmentTarget=function(node,role){
    if(!node || alignmentSeen.has(node)) return;
    alignmentSeen.add(node);
    alignmentTargets.push({node,role});
  };
  for(const camp of campaigns){
    addAlignmentTarget(nodes[camp.nameIdx],"campaignName");
    for(const g of camp.groups) addAlignmentTarget(nodes[g.nameIdx],"adGroupName");
  }

  return {
    plan,nodes,alignmentTargets,vatRateComparison,
    campaigns:campaigns.length,
    adGroups:adGroupCount,
    impressionsUpdated,
    oldCampaignSum:campaigns.reduce((a,b)=>a+b.oldSpend,0),
    newCampaignSum,
    invoiceNumber,
    optionalFields:{
      periodDescription:periodDescriptionStatus,
      total:totalHit?"PRESENT":"OPTIONAL / NOT PRESENT",
      paymentThreshold:thresholdHits===1?"PRESENT":"OPTIONAL / NOT PRESENT",
      vatRate:vatRateTargets.length===1?"PRESENT":"OPTIONAL / NOT PRESENT"
    }
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
      if(i&&arr[i-1].end>r.begin){
        const previous=arr[i-1];
        const excerpt=function(x){return JSON.stringify(String(x).slice(0,140));};
        throw new Error("overlapping ranges: "+previous.type+
          " ["+previous.begin+","+previous.end+") "+excerpt(previous.oldText)+
          " vs "+r.type+" ["+r.begin+","+r.end+") "+excerpt(r.oldText)+
          " | nodeText="+excerpt(current));
      }
    }
  }
}
function commitPlan(doc,plan,stt){
  // Runtime editability guard. Imported PDF text can be readable/searchable
  // but still reject replaceRange() in Affinity. Never hard-code a STT,
  // campaign index, page number, or invoice value for this condition.
  const blockedCampaigns=new Set();
  const blockedNodes=new Set();
  const manualFallbackTypes=new Set([
    "invoiceNumber",
    "campaignName","campaignDate","campaignSpend","adGroupSpend","impressions"
  ]);
  const orderedPlan=plan.slice().sort(function(a,b){
    if(a.type==="invoiceNumber"&&b.type!=="invoiceNumber") return 1;
    if(a.type!=="invoiceNumber"&&b.type==="invoiceNumber") return -1;
    return 0;
  });

  const groups=new Map();
  for(const r of orderedPlan){
    const arr=groups.get(r.node)||[];
    arr.push(r);
    groups.set(r.node,arr);
  }

  let step=0;
  const warnings=[];
  for(const [node,arr] of groups){
    arr.sort((a,b)=>b.begin-a.begin);
    for(const r of arr){
      step++;
      const campaignNo=r.meta&&r.meta.campaign?r.meta.campaign:null;
      const campaignField=
        r.type==="campaignName" || r.type==="campaignDate" ||
        r.type==="campaignSpend" || r.type==="adGroupSpend" ||
        r.type==="impressions";

      if(campaignNo!==null && campaignField && blockedCampaigns.has(campaignNo)){
        const meta=" C"+campaignNo+(r.meta&&r.meta.adGroup?"/G"+r.meta.adGroup:"");
        warnings.push({
          step:step,
          type:r.type,
          meta:meta,
          oldText:r.oldText,
          newText:r.newText,
          affinityMessage:"SKIPPED_AFTER_CAMPAIGN_COMMAND_FAILED",
          reason:
            "UNEDITABLE_CAMPAIGN_FALLBACK at step "+step+
            " | "+r.type+meta+
            " | ["+r.oldText+"] -> ["+r.newText+"]"+
            " | campaign already marked uneditable (often cross-page)"
        });
        continue;
      }

      if(blockedNodes.has(node) && manualFallbackTypes.has(r.type)){
        const meta=r.meta
          ? " "+(r.meta.campaign?"C"+r.meta.campaign:"")+(r.meta.adGroup?"/G"+r.meta.adGroup:"")
          : "";
        warnings.push({
          step:step,
          type:r.type,
          meta:meta,
          oldText:r.oldText,
          newText:r.newText,
          affinityMessage:"SKIPPED_AFTER_NODE_COMMAND_FAILED",
          reason:
            "UNEDITABLE_NODE_FALLBACK at step "+step+
            " | "+r.type+meta+
            " | ["+r.oldText+"] -> ["+r.newText+"]"+
            " | text node already marked uneditable"
        });
        continue;
      }

      try{
        replaceRange(doc,node,r.begin,r.end,r.newText);
      }catch(e){
        const meta=r.meta
          ? " "+(r.meta.campaign?"C"+r.meta.campaign:"")+(r.meta.adGroup?"/G"+r.meta.adGroup:"")
          : "";
        const detail={
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

        if(manualFallbackTypes.has(r.type)){
          blockedNodes.add(node);

          if(campaignNo!==null && campaignField){
            blockedCampaigns.add(campaignNo);
            detail.reason=
              "UNEDITABLE CAMPAIGN C"+campaignNo+
              " (often cross-page) | "+detail.reason;
          }else{
            detail.reason=
              "UNEDITABLE TEXT NODE | "+detail.reason;
          }

          warnings.push(detail);
          continue;
        }

        return {ok:false,warnings:warnings,failure:detail,reason:detail.reason};
      }
    }
  }
  return {ok:true,warnings:warnings};
}
function normalizeSemanticAlignment(doc,targets){
  for(const target of targets||[]){
    try{
      forceLeftAlignment(doc,target.node);
    }catch(e){
      throw new Error(
        "Alignment normalization failed for "+target.role+
        ": "+(e&&e.message?e.message:String(e))
      );
    }
  }
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
  let success=0,partial=0,error=0,skipped=0;

  for(let i=0;i<docs.length;i++){
    const doc=docs[i];
    const name=getDocName(doc);
    let parsed={stt:null,identity:[]};
    try{parsed=parseStt(doc);}catch(_){}
    const stt=parsed.stt;

    if(!(stt>=CONFIG.profile.stt.min&&stt<=CONFIG.profile.stt.max)){
      skipped++;
      report.push({document:name,status:"SKIPPED",reason:"outside batch / no STT",identity:parsed.identity||[]});
      continue;
    }
    const excludedStt=(CONFIG.profile.stt.excluded||[]);
    if(excludedStt.indexOf(stt)>=0){
      report.push({stt,document:name,status:"IGNORED",reason:"profile-excluded STT"});
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

      let commitWarnings=[];
      if(!CONFIG.dryRun){
        const commitResult=commitPlan(doc,built.plan,stt);
        commitWarnings=commitResult.warnings||[];
        if(!commitResult.ok){
          error++;
          report.push({
            stt,document:name,status:"ERROR",
            reason:commitResult.reason,
            commitFailure:commitResult
          });
          continue;
        }
        normalizeSemanticAlignment(doc,built.alignmentTargets);
        const warningKeys=new Set(commitWarnings.map(function(w){
          return w.type+"|"+w.oldText+"|"+w.newText+"|"+w.meta;
        }));
        postValidate(built.plan.filter(function(r){
          const meta=r.meta
            ? " "+(r.meta.campaign?"C"+r.meta.campaign:"")+(r.meta.adGroup?"/G"+r.meta.adGroup:"")
            : "";
          return !warningKeys.has(r.type+"|"+r.oldText+"|"+r.newText+"|"+meta);
        }));
      }

      const isPartial=!CONFIG.dryRun && commitWarnings.length>0;
      if(isPartial) partial++;
      else success++;

      report.push({
        stt,document:name,matchedBy:parsed.source,matchedValue:parsed.value,
        status:isPartial?"PARTIAL":"OK",
        mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
        campaigns:built.campaigns,
        adGroups:built.adGroups,
        impressionsUpdated:built.impressionsUpdated,
        validation:isPartial?"MANUAL_REQUIRED":"PASS",
        warnings:commitWarnings,
        invoiceNumber:built.invoiceNumber,
        vatRateComparison:built.vatRateComparison,
        optionalFields:built.optionalFields,
        replacements:built.plan.map(function(r){
          return {type:r.type,old:r.oldText,new:r.newText,meta:r.meta||null};
        })
      });
    }catch(e){
      error++;
      report.push({stt,document:name,status:"ERROR",reason:e.message||String(e)});
    }
  }

  console.log(CONFIG.profile.marker+JSON.stringify({
    mode:CONFIG.dryRun?"DRY RUN":"COMMIT",
    totalOpen:docs.length,success,partial,error,skipped,report
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
  const marker=profile.marker;
  const line=output.split(/\r?\n/).find(x=>x.includes(marker));
  if(!line) throw new Error("Affinity không trả batch report.\n"+output);

  const report=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
  // Diagnostic-only: engine output is never used to mutate Affinity text.
  const amountRowsByStt=new Map(source.items.map(x=>[x.stt,x]));
  console.log("\nBATCH "+String(profile.stt.min).padStart(2,"0")+"-"+String(profile.stt.max).padStart(2,"0")+" | "+report.mode);
  for(const r of report.report){
    const label=r.stt?("STT "+pad2(r.stt)):(r.document||"(unnamed document)");
    console.log(label+" ["+r.status+(r.reason?": "+r.reason:"")+"]");
    if(r.status==="SKIPPED"&&Array.isArray(r.identity)&&r.identity.length){
      console.log("  identity: "+r.identity.map(x=>x.label+"="+x.value).join(" | "));
    }
    if((r.status==="OK"||r.status==="PARTIAL")&&r.matchedBy){
      console.log("  matched by: "+r.matchedBy+" -> "+r.matchedValue);
      if(DRY_RUN){
        const row=amountRowsByStt.get(r.stt);
        if(row){
          const outcome=checkAmounts({
            base:row.subtotal,extra:row.vat,sum:row.total
          });
          console.log("  --- AMOUNT ENGINE (SOURCE, READ ONLY) ---");
          console.log("  Base (Tổng phụ): "+String(row.subtotal)+" VND");
          console.log("  Extra (VAT): "+String(row.vat)+" VND");
          console.log("  Sum (Tổng tiền): "+String(row.total)+" VND");
          if(outcome.status==="PASS_ARITHMETIC"){
            console.log("  Percent: "+outcome.percent.toFixed(2)+"%");
          }else{
            console.log("  Percent: N/A");
            console.log("  Reason: "+outcome.reason);
          }
          console.log("  Status: "+outcome.status);
        }
      }
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
        printOne("Thuế suất (%)","vatRate");
        const rateChanges=byType.vatRate||[];
        for(const change of rateChanges){
          const blocked=Array.isArray(r.warnings)&&r.warnings.some(w=>
            w.type==="vatRate" && w.oldText===change.old && w.newText===change.new
          );
          if(DRY_RUN){
            console.log("  Dự kiến hiệu chỉnh thuế suất từ "+change.old+"% sang "+change.new+"%");
          }else if(!blocked){
            console.log("  Đã hiệu chỉnh thuế suất từ "+change.old+"% sang "+change.new+"%");
          }else{
            console.log("  Chưa hiệu chỉnh được thuế suất từ "+change.old+"% sang "+change.new+"%");
          }
        }
        if(r.vatRateComparison){
          const v=r.vatRateComparison;
          const fmt=function(x){return typeof x==="number"&&Number.isFinite(x)?(Math.round(x*100)/100)+"%":"N/A";};
          console.log("  VAT Rate (tính từ số tiền): "+fmt(v.before)+"  ->  "+fmt(v.after));
          console.log("  Thuế suất ghi trên PDF gốc: "+(v.label||"không tìm thấy"));
          }
        printOne("Tổng thanh toán","total");
        printOne("Ngưỡng thanh toán","paymentThreshold");

        printOne("Mô tả chi tiêu quảng cáo","adSpendDescription");
        printOne("Phần nối mô tả","adSpendDescriptionSuffix");

        printOne("Invoice #","invoiceNumber");

        printOne("Campaign name","campaignName");
        printOne("Campaign date","campaignDate");
        printOne("Campaign spend","campaignSpend");
        printOne("Ad group spend","adGroupSpend");
        printOne("Impressions","impressions");

        console.log("  campaigns: "+r.campaigns+" | ad groups: "+r.adGroups+" | impressions updated: "+r.impressionsUpdated);
        if(r.optionalFields){
          if(r.optionalFields.periodDescription!=="DISABLED") console.log("  Period description: "+r.optionalFields.periodDescription);
          console.log("  Total: "+(r.optionalFields.total==="PRESENT"?"PASS":"OPTIONAL / NOT PRESENT"));
          console.log("  Threshold: "+(r.optionalFields.paymentThreshold==="PRESENT"?"PASS":"OPTIONAL / NOT PRESENT"));
        }
        console.log("  validation: "+r.validation);
        if(Array.isArray(r.warnings)&&r.warnings.length){
          for(const w of r.warnings){
            if(w.type==="invoiceNumber"){
              console.log("  INVOICE WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi Invoice # thành "+w.newText);
            }else if(w.type==="campaignName"){
              console.log("  CAMPAIGN NAME WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi campaign name thành "+w.newText);
            }else if(w.type==="campaignDate"){
              console.log("  CAMPAIGN DATE WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi campaign date thành "+w.newText);
            }else if(w.type==="campaignSpend"){
              console.log("  CAMPAIGN SPEND WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi campaign spend thành "+w.newText);
            }else if(w.type==="adGroupSpend"){
              console.log("  AD GROUP SPEND WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi ad group spend thành "+w.newText);
            }else if(w.type==="impressions"){
              console.log("  IMPRESSIONS WARNING: "+w.reason);
              console.log("  MANUAL FALLBACK: đổi impressions thành "+w.newText);
            }else{
              console.log("  WARNING: "+w.reason);
            }
          }
        }
      }
    }
  }
  console.log("\nSUCCESS: "+report.success+" PARTIAL: "+(report.partial||0)+" ERROR: "+report.error+" SKIPPED: "+report.skipped);
  if((report.partial||0)>0){
    console.log("MANUAL REQUIRED: "+report.partial+" document chưa khớp hoàn toàn source JSON.");
  }

  if(DRY_RUN){
    console.log("\nDRY_RUN=true: không có text nào được thay.");
    console.log("Để commit các field đã validate: set AFFINITY_COMMIT=1 rồi chạy lại.");
  }

  if(report.error>0){
    throw new Error("Batch có "+report.error+" document lỗi. Xem chi tiết COMMAND_FAILED phía trên.");
  }

  if(DRY_RUN && ((report.skipped||0)>0 || report.success===0)){
    throw new Error(
      "DRY RUN chưa an toàn: SUCCESS="+report.success+
      " SKIPPED="+(report.skipped||0)+
      ". Không được hỏi COMMIT khi còn document bị bỏ qua hoặc không có document hợp lệ."
    );
  }

  if(!DRY_RUN && (report.partial||0)>0){
    throw new Error(
      "COMMIT chưa hoàn tất: có "+report.partial+
      " document PARTIAL / MANUAL_REQUIRED. Không được coi là DONE cho tới khi document khớp source JSON."
    );
  }
}
