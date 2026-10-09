import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadVhmSourceData } from "../clients/prohomes3/vhm/source-data.mjs";
import t7 from "../clients/prohomes3/vhm/profiles/t7-2026.mjs";
import t8 from "../clients/prohomes3/vhm/profiles/t8-2026.mjs";
import t9 from "../clients/prohomes3/vhm/profiles/t9-2026.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

test("VHM T7/T8/T9 source validates with expected active counts",()=>{
  assert.equal(loadVhmSourceData(t7,root).items.length,36);
  assert.equal(loadVhmSourceData(t8,root).items.length,36);
  assert.equal(loadVhmSourceData(t9,root).items.length,45);
});

test("VHM invoice numbers use FBADS-542 and legacy JSON shape",()=>{
  for(const profile of [t7,t8,t9]){
    const source=loadVhmSourceData(profile,root);
    for(const row of source.items){
      assert.match(row.invoiceNumber,/^FBADS-542-\d{9}$/);
      assert.equal("invoiceNumberKind" in row,false);
      assert.equal(row.subtotal+row.vat,row.total);
    }
  }
});

test("VHM T8 excludes unsupported ad-credit receipt STT 66",()=>{
  assert.deepEqual(t8.stt.excluded,[66]);
  const source=loadVhmSourceData(t8,root);
  assert.equal(source.items.some(x=>x.stt===66),false);
});
