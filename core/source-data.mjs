import fs from "node:fs";
import path from "node:path";

function fail(msg){ throw new Error(msg); }

export function loadSourceData(profile, repoDir){
  const dataPath=path.join(repoDir, profile.dataFile);
  const raw=JSON.parse(fs.readFileSync(dataPath,"utf8"));

  if(!Array.isArray(raw.items) || raw.items.length!==profile.stt.expectedCount){
    fail("Source JSON phải có đúng "+profile.stt.expectedCount+" items.");
  }

  const seen=new Set();
  const invoiceRe=new RegExp(profile.invoiceNumber.pattern);

  for(const x of raw.items){
    if(!Number.isInteger(x.stt) || x.stt<profile.stt.min || x.stt>profile.stt.max){
      fail("STT không hợp lệ: "+x.stt);
    }
    if(seen.has(x.stt)) fail("Duplicate STT: "+x.stt);
    seen.add(x.stt);

    if(!x.transactionId || !x.timestamp || !x.invoiceNumber){
      fail("Thiếu ID/timestamp/invoiceNumber tại STT "+x.stt);
    }
    if(!invoiceRe.test(x.invoiceNumber)){
      fail("invoiceNumber không hợp lệ tại STT "+x.stt+": "+x.invoiceNumber);
    }

    for(const k of ["subtotal","vat","total"]){
      if(!Number.isInteger(x[k]) || x[k]<0){
        fail("Money không hợp lệ "+k+" tại STT "+x.stt);
      }
    }
    if(x.subtotal+x.vat!==x.total){
      fail("subtotal + VAT != total tại STT "+x.stt);
    }
  }

  for(let i=profile.stt.min;i<=profile.stt.max;i++){
    if(!seen.has(i)) fail("Thiếu STT "+i);
  }

  return raw;
}
