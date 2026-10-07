import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_URL="http://localhost:6767/sse";

function getTextContent(result){
  return (result?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}

async function main(){
  const client=new Client({name:"phong-affinity-save-api-diagnostic",version:"1.0.0"});
  const transport=new SSEClientTransport(new URL(SERVER_URL));
  await client.connect(transport);
  try{
    await client.request({
      method:"tools/call",
      params:{name:"read_sdk_documentation_topic",arguments:{filename:"preamble"}}
    },CallToolResultSchema);

    const script=String.raw`
"use strict";
const documentModule=require("/document");
const fsModule=require("/fs.js");
const { Document }=documentModule;
const { FileSystemApi }=fsModule;

function props(obj){
  const out=[];
  let cur=obj;
  const seen={};
  while(cur){
    let names=[];
    try{names=Object.getOwnPropertyNames(cur);}catch(_){}
    for(const n of names){
      if(seen[n])continue;
      seen[n]=true;
      let t="?";
      try{t=typeof obj[n];}catch(_){}
      out.push(n+":"+t);
    }
    try{cur=Object.getPrototypeOf(cur);}catch(_){break;}
  }
  return out.sort();
}

(function(){
  let doc=null;
  try{doc=Document.current;}catch(_){}
  function fnInfo(fn){
    if(typeof fn!=="function") return null;
    let src="";
    try{src=String(fn);}catch(_){}
    return {length:fn.length,source:src.slice(0,500)};
  }
  console.log("__PHONG_SAVE_API__"+JSON.stringify({
    fsModuleExports:Object.keys(fsModule||{}).sort(),
    documentModuleExports:Object.keys(documentModule||{}).sort(),
    fileSystemApi:props(FileSystemApi),
    document:doc?props(doc):[],
    documentTitle:doc?String(doc.title||doc.name||""):"",
    documentPath:doc?String(doc.path||""):"",
    mustSaveAs:doc?doc.mustSaveAs:null,
    isReadOnly:doc?doc.isReadOnly:null,
    saveAs:doc?fnInfo(doc.saveAs):null,
    saveAsAsync:doc?fnInfo(doc.saveAsAsync):null,
    save:doc?fnInfo(doc.save):null,
    saveAsync:doc?fnInfo(doc.saveAsync):null
  }));
})();
`;

    const result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);
    const output=getTextContent(result);
    const marker="__PHONG_SAVE_API__";
    const line=output.split(/\r?\n/).find(x=>x.includes(marker));
    if(!line)throw new Error("Affinity không trả diagnostic.\n"+output);
    const p=JSON.parse(line.slice(line.indexOf(marker)+marker.length));

    console.log("\n=== FS MODULE EXPORTS ===");
    for(const x of p.fsModuleExports)console.log(x);
    console.log("\n=== DOCUMENT MODULE EXPORTS ===");
    for(const x of p.documentModuleExports)console.log(x);
    console.log("\n=== SAVE SIGNATURES ===");
    console.log("saveAs:",JSON.stringify(p.saveAs));
    console.log("saveAsAsync:",JSON.stringify(p.saveAsAsync));
    console.log("save:",JSON.stringify(p.save));
    console.log("saveAsync:",JSON.stringify(p.saveAsync));
    console.log("path:",p.documentPath);
    console.log("mustSaveAs:",p.mustSaveAs,"isReadOnly:",p.isReadOnly);
    console.log("\n=== FILESYSTEM API ===");
    for(const x of p.fileSystemApi)console.log(x);
    console.log("\n=== DOCUMENT API ===");
    for(const x of p.document)console.log(x);
    console.log("\nDocument: "+p.documentTitle);
  }finally{
    try{await client.close();}catch(_){}
  }
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
