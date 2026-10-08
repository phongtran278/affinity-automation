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
    .replace("const offset=CONFIG.profile.campaign.startOffsetDays.base+\n    ((stt-1)%CONFIG.profile.campaign.startOffsetDays.cycle);","const offset=3+((stt-1)%4);")
    .replace(/const NAME_BASE=CONFIG.profile.campaign.naming.base;[\s\S]*?const NAME_SEP=CONFIG.profile.campaign.naming.separator;/,campaignConstants[0])
    .replace('new RegExp(CONFIG.profile.invoiceNumber.documentPattern,"i")','/FBADS-179-\\d+/i')
    .replace("CONFIG.profile.stt.min&&stt<=CONFIG.profile.stt.max","1&&stt<=42")
    .replace("CONFIG.profile.marker+JSON.stringify",'"__PHONG_BATCH_T7__"+JSON.stringify')
    .replace('    invoiceNumber,\n    optionalFields:{\n      total:totalHit?"PRESENT":"OPTIONAL / NOT PRESENT",\n      paymentThreshold:thresholdHits===1?"PRESENT":"OPTIONAL / NOT PRESENT"\n    }','    invoiceNumber')
    .replace("        optionalFields:built.optionalFields,\n","");
}

test("T7 embedded parser matches pinned stable baseline after approved profile/report substitutions",()=>{
  const original=execFileSync("git",["show",baseline+":batch-edit-prohomes-t7.mjs"],{cwd:root,encoding:"utf8"});
  const current=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  const a=embedded(original);
  const b=canonicalCurrent(embedded(current),a);
  assert.equal(b,a,"Unexpected change in embedded Affinity parser: investigate before committing");
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
    check(valid.items.map((x,i)=>i===0?{...x,total:x.total+1}:x),/subtotal \+ VAT != total/);
    check(valid.items.map((x,i)=>i===0?{...x,invoiceNumber:"INVALID"}:x),/invoiceNumber không hợp lệ/);
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});

test("T7 defaults to dry run and reports absent optional fields",()=>{
  const code=fs.readFileSync(path.join(root,"core/run-batch.mjs"),"utf8");
  assert.match(code,/process\.env\.AFFINITY_COMMIT==="1" \? false : true/);
  assert.match(code,/total:totalHit\?"PRESENT":"OPTIONAL \/ NOT PRESENT"/);
  assert.match(code,/paymentThreshold:thresholdHits===1\?"PRESENT":"OPTIONAL \/ NOT PRESENT"/);
  assert.match(code,/optionalFields:built\.optionalFields/);
});
