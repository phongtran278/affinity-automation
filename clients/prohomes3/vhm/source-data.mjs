import fs from "node:fs";
import path from "node:path";
import { checkAmounts } from "../../../core/amout-engine.mjs";

function fail(msg){ throw new Error(msg); }

export function loadVhmSourceData(profile, repoDir){
  const dataPath=path.join(repoDir, profile.dataFile);
  const raw=JSON.parse(fs.readFileSync(dataPath,"utf8"));
  if(!Array.isArray(raw.items)) fail("VHM source JSON thiếu items.");

  const expectedSourceCount=profile.stt.expectedSourceCount ?? profile.stt.expectedCount;
  if(raw.items.length!==expectedSourceCount){
    fail("VHM source JSON phải có đúng "+expectedSourceCount+" items.");
  }

  const excluded=new Set(profile.stt.excluded||[]);
  const seen=new Set();
  const active=[];
  const invoiceRe=new RegExp(profile.invoiceNumber.pattern);

  for(const x of raw.items){
    if(!Number.isInteger(x.stt) || x.stt<profile.stt.min || x.stt>profile.stt.max){
      fail("STT không hợp lệ: "+x.stt);
    }
    if(seen.has(x.stt)) fail("Duplicate STT: "+x.stt);
    seen.add(x.stt);

    if(!x.transactionId || !x.timestamp){
      fail("Thiếu ID/timestamp tại STT "+x.stt);
    }

    if(excluded.has(x.stt)) continue;

    if(!x.invoiceNumber) fail("Thiếu invoiceNumber tại STT "+x.stt);
    if(!invoiceRe.test(x.invoiceNumber)){
      fail("invoiceNumber không hợp lệ tại STT "+x.stt+": "+x.invoiceNumber);
    }

    for(const k of ["subtotal","vat","total"]){
      if(!Number.isInteger(x[k]) || x[k]<0){
        fail("Money không hợp lệ "+k+" tại STT "+x.stt);
      }
    }
    const check=checkAmounts({base:x.subtotal,extra:x.vat,sum:x.total});
    if(check.status!=="PASS_ARITHMETIC")
      fail("Amount validation STT "+x.stt+": "+check.reason);
    active.push(x);
  }

  for(let i=profile.stt.min;i<=profile.stt.max;i++){
    if(!seen.has(i)) fail("Thiếu STT "+i);
  }
  if(active.length!==profile.stt.expectedCount){
    fail("VHM active source phải có đúng "+profile.stt.expectedCount+" items.");
  }

  return {...raw,items:active};
}
