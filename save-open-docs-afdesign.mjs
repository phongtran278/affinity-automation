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
async function moveFileCrossDrive(source,target){
  try{await fs.promises.rename(source,target);}
  catch(err){
    if(err&&err.code==="EXDEV"){
      await fs.promises.copyFile(source,target,fs.constants.COPYFILE_EXCL);
      await fs.promises.unlink(source);
      return;
    }
    throw err;
  }
}

async function main(){
  const destination=chooseFolder();
  if(!destination)process.exit(0);

  const client=new Client({name:"phong-affinity-save-afdesign",version:"1.1.0"});
  const transport=new SSEClientTransport(new URL(SERVER_URL));
  await client.connect(transport);

  try{
    await client.request({
      method:"tools/call",
      params:{name:"read_sdk_documentation_topic",arguments:{filename:"preamble"}}
    },CallToolResultSchema);

    const stagingName="Affinity_AFDesign_Save_"+new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14);

    const script=String.raw`
"use strict";
const { app }=require("/application");
const { Document }=require("/document");
const { FileSystemApi }=require("/fs.js");

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
function makeAsciiOutputName(title,index){
  const s=String(title||"");
  const tx=(s.match(/\b(\d{10,}-\d{10,})\b/)||[])[1]||("doc-"+String(index+1).padStart(2,"0"));
  const dt=(s.match(/\b(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2})\b/)||[])[1];
  const stt=(s.match(/^\s*(\d{1,2})\s*[-_]/)||[])[1];
  if(stt) return String(stt).padStart(2,"0")+"_"+tx+".afdesign";
  if(dt) return dt+"_"+tx+".afdesign";
  return tx+".afdesign";
}
function joinPath(a,b){
  return a+(a.endsWith("\\")||a.endsWith("/")?"":"\\")+b;
}

(async function(){
  let docs=[];
  try{docs=toArray(Document.all);}catch(_){}
  if(!docs.length&&Document.current)docs=[Document.current];
  if(!docs.length)throw new Error("Không có document nào đang mở.");

  const desktop=app.userDesktopPath||app.getUserDesktopPath;
  if(!desktop)throw new Error("Không lấy được Desktop path.");

  const stagingFolder=joinPath(String(desktop),${JSON.stringify(stagingName)});
  FileSystemApi.createDirectories(stagingFolder);

  const report=[];
  const used={};

  for(let i=0;i<docs.length;i++){
    const doc=docs[i];
    let title="";
    try{title=String(doc.title||doc.name||("Document "+(i+1)));}catch(_){title="Document "+(i+1);}
    const filename=makeAsciiOutputName(title,i);
    const stagingFilename="doc_"+String(i+1).padStart(2,"0")+".afdesign";
    const out=joinPath(stagingFolder,stagingFilename);

    if(used[filename]){
      report.push({title,status:"ERROR",reason:"Trùng tên output: "+filename});
      continue;
    }
    used[filename]=true;

    try{
      if(typeof doc.saveAs!=="function" || typeof doc.save!=="function"){
        report.push({title,status:"ERROR",reason:"Không có saveAs/save"});
        continue;
      }

      // Affinity runtime này dùng saveAs(path) để gán native document path,
      // sau đó cần save() để thực sự ghi bytes xuống đĩa.
      doc.saveAs(out);
      doc.save();

      let exists=false;
      try{
        exists=typeof FileSystemApi.existsAsync==="function"
          ? await FileSystemApi.existsAsync(out)
          : FileSystemApi.exists(out);
      }catch(_){}
      if(!exists){
        let currentPath="";
        try{currentPath=String(doc.path||"");}catch(_){}
        report.push({
          title,status:"ERROR",
          reason:"SAVE_RETURNED_BUT_FILE_NOT_CREATED",
          filename,stagingFilename,path:out,currentPath
        });
        continue;
      }
      report.push({title,status:"OK",filename,stagingFilename,path:out});
    }catch(e){
      report.push({title,status:"ERROR",reason:e&&e.message?e.message:String(e),filename,path:out});
    }
  }

  console.log("__PHONG_SAVE_AFDESIGN__"+JSON.stringify({
    stagingFolder,total:docs.length,report
  }));
})().catch(function(e){
  console.log("__PHONG_SAVE_AFDESIGN_FATAL__"+String(e&&e.message?e.message:e));
});
`;

    const result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);

    const output=getTextContent(result);
    const marker="__PHONG_SAVE_AFDESIGN__";
    const line=output.split(/\r?\n/).find(x=>x.includes(marker));
    if(!line)throw new Error("Affinity không trả save report.\n"+output);

    const payload=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
    if(!payload.stagingFolder)throw new Error("Không nhận được staging folder.");

    let moved=0;
    const moveErrors=[];

    for(const r of payload.report){
      if(r.status!=="OK")continue;
      const source=path.join(payload.stagingFolder,r.stagingFilename||r.filename);
      const target=path.join(destination,r.filename);
      try{
        if(fs.existsSync(target)){
          await fs.promises.unlink(target);
        }
        await moveFileCrossDrive(source,target);
        moved++;
      }catch(e){
        moveErrors.push(r.filename+" | "+(e?.message||String(e)));
      }
    }

    const remaining=await fs.promises.readdir(payload.stagingFolder).catch(()=>[]);
    if(!remaining.length)await fs.promises.rmdir(payload.stagingFolder).catch(()=>{});

    console.log("\nSAVE ALL OPEN DOCS -> AFDESIGN");
    console.log("Folder: "+destination);
    for(const r of payload.report){
      if(r.status==="OK")console.log("[OK] "+r.filename);
      else console.log("[ERROR] "+r.title+" | "+r.reason+(r.currentPath?" | doc.path="+r.currentPath:""));
    }
    if(moveErrors.length){
      console.log("\nMOVE ERRORS:");
      for(const x of moveErrors)console.log("- "+x);
    }

    const affinityErrors=payload.report.filter(r=>r.status!=="OK").length;
    console.log("\nSAVED: "+moved+" / "+payload.total);
    if(affinityErrors||moveErrors.length)process.exitCode=1;
  }finally{
    try{await client.close();}catch(_){}
  }
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
