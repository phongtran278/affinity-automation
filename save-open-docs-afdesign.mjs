import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const SERVER_URL="http://localhost:6767/sse";

function chooseFolder(){
  try{
    return String(execFileSync("powershell.exe",[
      "-NoProfile","-STA","-ExecutionPolicy","Bypass",
      "-File",path.join(__dirname,"choose-folder.ps1")
    ],{encoding:"utf8",windowsHide:true})||"").trim();
  }catch{return "";}
}

function getTextContent(result){
  return (result?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}

async function main(){
  const destination=chooseFolder();
  if(!destination) process.exit(0);

  const client=new Client({name:"phong-affinity-save-afdesign",version:"1.0.0"});
  const transport=new SSEClientTransport(new URL(SERVER_URL));
  await client.connect(transport);

  try{
    await client.request({
      method:"tools/call",
      params:{name:"read_sdk_documentation_topic",arguments:{filename:"preamble"}}
    },CallToolResultSchema);

    const payload=JSON.stringify({destination});
    const script=String.raw`
"use strict";
const { Document }=require("/document");
const CONFIG=${payload};

function toArray(c){
  if(!c)return [];
  try{if(c.toArray)return c.toArray();}catch(_){}
  try{return Array.from(c);}catch(_){}
  return [];
}
function cleanName(s){
  s=String(s||"Untitled").replace(/[\\/:*?"<>|]/g,"_");
  s=s.replace(/\.(pdf|afdesign)$/i,"");
  return s+".afdesign";
}
function joinPath(a,b){
  return a+(a.endsWith("\\")||a.endsWith("/")?"":"\\")+b;
}

(function(){
  let docs=[];
  try{docs=toArray(Document.all);}catch(_){}
  if(!docs.length&&Document.current)docs=[Document.current];
  if(!docs.length)throw new Error("Không có document nào đang mở.");

  const report=[];
  const used={};

  for(let i=0;i<docs.length;i++){
    const doc=docs[i];
    let title="";
    try{title=String(doc.title||doc.name||("Document "+(i+1)));}catch(_){title="Document "+(i+1);}
    const filename=cleanName(title);
    const out=joinPath(CONFIG.destination,filename);

    if(used[out]){
      report.push({title,status:"ERROR",reason:"Trùng tên output: "+filename});
      continue;
    }
    used[out]=true;

    try{
      if(typeof doc.saveAs!=="function"){
        const candidates=[];
        for(const k of ["saveAs","save","saveTo","saveCopyAs","saveCopy"]){
          try{if(typeof doc[k]==="function")candidates.push(k);}catch(_){}
        }
        report.push({
          title,status:"ERROR",
          reason:"Affinity scripting hiện không expose doc.saveAs(path). Save candidates: "+(candidates.join(", ")||"(none)")
        });
        continue;
      }

      doc.saveAs(out);
      report.push({title,status:"OK",filename,path:out});
    }catch(e){
      report.push({title,status:"ERROR",reason:e&&e.message?e.message:String(e),filename,path:out});
    }
  }

  console.log("__PHONG_SAVE_AFDESIGN__"+JSON.stringify({destination,total:docs.length,report}));
})();
`;

    const result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);

    const output=getTextContent(result);
    const marker="__PHONG_SAVE_AFDESIGN__";
    const line=output.split(/\r?\n/).find(x=>x.includes(marker));
    if(!line)throw new Error("Affinity không trả save report.\n"+output);

    const report=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
    console.log("\nSAVE ALL OPEN DOCS -> AFDESIGN");
    console.log("Folder: "+report.destination);

    let ok=0,err=0;
    for(const r of report.report){
      if(r.status==="OK"){
        ok++;
        console.log("[OK] "+r.filename);
      }else{
        err++;
        console.log("[ERROR] "+r.title+" | "+r.reason);
      }
    }
    console.log("\nSUCCESS: "+ok+" ERROR: "+err+" TOTAL: "+report.total);
    if(err)process.exitCode=1;
  }finally{
    try{await client.close();}catch(_){}
  }
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
