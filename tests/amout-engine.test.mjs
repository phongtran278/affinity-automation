import test from "node:test";
import assert from "node:assert/strict";
import { checkAmounts } from "../core/amout-engine.mjs";

test("8% arithmetic passes",()=>{
  assert.deepEqual(checkAmounts({base:15000000,extra:1200000,sum:16200000}),
    {status:"PASS_ARITHMETIC",percent:8,base:15000000,extra:1200000,sum:16200000});
});
test("10% rounded VND arithmetic passes",()=>{
  assert.equal(checkAmounts({base:18363636,extra:1836364,sum:20200000}).percent,10);
});
test("passed percent is always overwritten by the amount-derived percent",()=>{
  assert.equal(checkAmounts({base:1000000,extra:50000,sum:1050000,percent:10}).percent,5);
});
test("percent is rounded to 2 decimals",()=>{
  assert.equal(checkAmounts({base:300,extra:20,sum:320}).percent,6.67);
});
test("wrong sum requires review",()=>{
  assert.equal(checkAmounts({base:15000000,extra:1200000,sum:16000000}).status,"REVIEW_REQUIRED");
});
test("zero base requires review",()=>{
  assert.equal(checkAmounts({base:0,extra:0,sum:0}).reason,"Zero base");
});
test("invalid negative or unsafe integer requires review",()=>{
  assert.equal(checkAmounts({base:-1,extra:1,sum:0}).status,"REVIEW_REQUIRED");
  assert.equal(checkAmounts({base:Number.MAX_SAFE_INTEGER+1,extra:0,sum:0}).status,"REVIEW_REQUIRED");
});
