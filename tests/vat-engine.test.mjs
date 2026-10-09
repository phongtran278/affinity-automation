import test from "node:test";
import assert from "node:assert/strict";
import {inspectVat} from "../core/vat-engine.mjs";

test("8% arithmetic passes",()=>{
 assert.equal(inspectVat({subtotal:15000000,vat:1200000,total:16200000}).calculatedRate,8);
});
test("10% rounded VND arithmetic passes",()=>{
 assert.equal(inspectVat({subtotal:18363636,vat:1836364,total:20200000}).calculatedRate,10);
});
test("wrong totals fail closed",()=>{
 assert.equal(inspectVat({subtotal:15000000,vat:1200000,total:16000000}).status,"REVIEW_REQUIRED");
});
test("declared VAT contradiction requires review",()=>{
 assert.equal(inspectVat({subtotal:15000000,vat:1200000,total:16200000,declaredRate:10}).status,"REVIEW_REQUIRED");
});
test("unusual rate is reviewable, not coerced",()=>{
 assert.equal(inspectVat({subtotal:1000000,vat:50000,total:1050000}).status,"REVIEW_REQUIRED");
});
