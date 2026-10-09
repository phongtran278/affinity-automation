import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import profile from "../profiles/prohomes-t7.mjs";
import { FIELD_STATE } from "../rules/field-policy.mjs";
import { loadSourceData } from "../core/source-data.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const baseline="d862ab22f8ebc46d26c8042db8f622046da84e53";

function embedded(text){
  // Windows CRLF and Unix LF must compare as the same source code.
  const normalized=text.replace(/\r\n?/g,"\n");
  const start=normalized.indexOf("function toArray(c)");
  const end=normalized.indexOf("\n`;",start);
  assert.ok(start>=0 && end>start,"Embedded Affinity script not found");
  return normalized.slice(start,end);
}
function canonicalCurrent(text,reference){
  const campaignConstants=reference.match(/const NAME_BASE=[\s\S]*?const NAME_SEP=.*?;/);
  assert.ok(campaignConstants,"Baseline campaign naming constants missing");
  return text
    // Exclude only the independently gated T7 V2 description extension;
    // keep all previously pinned parser logic byte-for-byte protected.
    .replace(/  \/\/ Opt-in T7 V2: reconcile the existing ad-spend description[\s\S]*?\n  let invoiceNumber=null;/,
      "  let invoiceNumber=null;")
    .replace(/if\(i&&arr\[i-1\]\.end>r\.begin\)\{[\s\S]*?\n      \}/,
      'if(i&&arr[i-1].end>r.begin) throw new Error("overlapping ranges");')
    .replace(/      \/\/ T7 V2 replaces the entire legacy invoice-threshold sentence\.[\s\S]*?      if\(insideDescription\) continue;\n/, "")
    .replace("const offset=CONFIG.profile.campaign.startOffsetDays.base+\n    ((stt-1)%CONFIG.profile.campaign.startOffsetDays.cycle);","const offset=3+((stt-1)%4);")
    .replace(/const NAME_BASE=CONFIG.profile.campaign.naming.base;[\s\S]*?const NAME_SEP=CONFIG.profile.campaign.naming.separator;/,campaignConstants[0])
    .replace('new RegExp(CONFIG.profile.invoiceNumber.documentPattern,"i")','/FBADS-179-\\d+/i')
    .replace("CONFIG.profile.stt.min&&stt<=CONFIG.profile.stt.max","1&&stt<=42")
    .replace("CONFIG.profile.marker+JSON.stringify",'"__PHONG_BATCH_T7__"+JSON.stringify')
    .replace('    invoiceNumber,\n    optionalFields:{\n      total:totalHit?"PRESENT":"OPTIONAL / NOT PRESENT",\n      paymentThreshold:thresholdHits===1?"PRESENT":"OPTIONAL / NOT PRESENT"\n    }','    invoiceNumber')
    .replace("        optionalFields:built.optionalFields,\n","");
}

function functionBlock(text,name){
  const start=text.indexOf("function "+name+"(");
  assert.ok(start>=0,"Function not found: "+name);
  const next=text.indexOf("\nfunction ",start+9);
  const nextConst=text.indexOf("\nconst NAME_",start+9);
  const ends=[next,nextConst].filter(x=>x>start);
  const end=ends.length?Math.min(...ends):text.length;
  return text.slice(start,end).trim();
}

test("T7 stable business/parser functions match pinned baseline while shared-core safety fixes may evolve",()=>{
  const original=execFileSync("git",["show",baseline+":batch-edit-prohomes-t7.mjs"],{cwd:root,encoding:"utf8"});
  const current=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  const a=embedded(original);
  const b=canonicalCurrent(embedded(current),a);

  // Pin the T7 parsing/math/business functions that must remain behaviorally stable.
  // Generic commit/selection/reporting compatibility is intentionally excluded:
  // it is shared by T7/T8/T9 and may evolve to fix Affinity SDK issues.
  const pinned=[
    "timestampParts",
    "formatInvoiceDate",
    "moneyTokens",
    "moneyOnly",
    "normalizeMoney",
    "formatMoneyLike",
    "parseImpression",
    "formatIntegerLike",
    "paragraphNameRangeBefore",
    "findExactLabel",
    "allocation",
    "parseCampaigns"
  ];

  for(const name of pinned){
    assert.equal(
      functionBlock(b,name),
      functionBlock(a,name),
      "Unexpected T7 business/parser change in "+name
    );
  }

  // Shared compatibility invariant introduced after the pinned baseline.
  assert.match(current,/createSetCurrentSpread\(spread\)/);
  assert.match(current,/spread=node\.spread\|\|null/);
  assert.match(current,/StoryDelta\.createAlignX\(ParagraphAlignXType\.Left\)/);
  assert.match(current,/normalizeSemanticAlignment\(doc,built\.alignmentTargets\)/);
});

test("T7 campaign naming uses complete semantic phrases and caps names at 31 characters",()=>{
  const code=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  assert.equal(profile.campaign.naming.maxLength,31);
  assert.equal(profile.campaign.naming.compactBase,"Vin Cần Giờ");
  assert.equal(profile.campaign.naming.compactMonth,"T7/2026");
  assert.match(code,/Array\.from\(original\)\.length<=maxLength/);
  assert.match(code,/Never truncate a campaign name mid-word/);
  assert.doesNotMatch(code,/\.slice\(0,maxLength\)/);
});

test("T7 profile keeps 42 invoices and optional payment fields",()=>{
  assert.deepEqual(profile.stt,{min:1,max:42,expectedCount:42});
  assert.equal(profile.fields.total,FIELD_STATE.OPTIONAL);
  assert.equal(profile.fields.paymentThreshold,FIELD_STATE.OPTIONAL);
  assert.equal(profile.fields.paid,FIELD_STATE.REQUIRED);
  assert.equal(profile.fields.subtotal,FIELD_STATE.REQUIRED);
  assert.equal(profile.fields.vat,FIELD_STATE.REQUIRED);
  assert.equal(profile.compatibility.mergedTextNodes,true);
  assert.equal(profile.compatibility.separatedTextNodes,true);
});

test("T7 source validates expected count, identity and money arithmetic",()=>{
  const valid=loadSourceData(profile,root);
  assert.equal(valid.items.length,42);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"affinity-t7-"));
  const testProfile={...profile,dataFile:"source.json"};
  const check=(items,pattern)=> {
    fs.writeFileSync(path.join(temp,"source.json"),JSON.stringify({...valid,items}));
    assert.throws(()=>loadSourceData(testProfile,temp),pattern);
  };
  try{
    check(valid.items.slice(1),/đúng 42 items/);
    check([valid.items[0],valid.items[0],...valid.items.slice(2)],/Duplicate STT/);
    check(valid.items.map((x,i)=>i===0?{...x,total:x.total+1}:x),/base \+ extra != sum/);
    check(valid.items.map((x,i)=>i===0?{...x,invoiceNumber:"INVALID"}:x),/invoiceNumber không hợp lệ/);
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});

test("document STT parser supports 3+ digit monthly sequence numbers and dry-run blocks skipped docs",()=>{
  const code=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  assert.match(code,/base\.match\(\/\^\(\\d\+\)\\s\*-\\s\*\/\)/);
  assert.match(code,/DRY_RUN && \(\(report\.skipped\|\|0\)>0 \|\| report\.success===0\)/);
});

test("T7 defaults to dry run and reports absent optional fields",()=>{
  const code=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  assert.match(code,/process\.env\.AFFINITY_COMMIT==="1" \? false : true/);
  assert.match(code,/total:totalHit\?"PRESENT":"OPTIONAL \/ NOT PRESENT"/);
  assert.match(code,/paymentThreshold:thresholdHits===1\?"PRESENT":"OPTIONAL \/ NOT PRESENT"/);
  assert.match(code,/optionalFields:built\.optionalFields/);
});
