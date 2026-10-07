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
const { Document }=require("/document");
const { FileSystemApi }=require("/fs.js");

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
  console.log("__PHONG_SAVE_API__"+JSON.stringify({
    fileSystemApi:props(FileSystemApi),
    document:doc?props(doc):[],
    documentTitle:doc?String(doc.title||doc.name||""):""
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
