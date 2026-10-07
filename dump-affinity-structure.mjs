import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const SERVER_URL="http://localhost:6767/sse";

function getTextContent(result){
  return (result?.content||[])
    .filter(x=>x&&x.type==="text")
    .map(x=>x.text)
    .join("\n");
}

async function main(){
  const client=new Client({name:"phong-affinity-structure-dump",version:"1.0.0"});
  const transport=new SSEClientTransport(new URL(SERVER_URL));

  await client.connect(transport);

  try{
    await client.request({
      method:"tools/call",
      params:{
        name:"read_sdk_documentation_topic",
        arguments:{filename:"preamble"}
      }
    },CallToolResultSchema);

    const script=`
"use strict";
const { Document } = require("/document");
const { StoryIoFormat } = require("affinity:story");

function toArray(c){
  if(!c) return [];
  try{ if(c.toArray) return c.toArray(); }catch(_){}
  try{ return Array.from(c); }catch(_){}
  return [];
}
function getRawText(node){
  try{return node.getText(0,-1,StoryIoFormat.Raw);}catch(_){}
  try{return node.story?node.story.getText(0,-1):"";}catch(_){}
  return "";
}
function identity(doc){
  const out={};
  const grab=(k,fn)=>{try{const v=fn(); if(v!==undefined&&v!==null&&String(v)!=="") out[k]=String(v);}catch(_){}};
  grab("name",()=>doc.name);
  grab("title",()=>doc.title);
  grab("path",()=>doc.path);
  grab("filePath",()=>doc.filePath);
  grab("sourcePath",()=>doc.sourcePath);
  grab("sourceFilePath",()=>doc.sourceFilePath);
  grab("uri",()=>doc.uri);
  try{
    if(doc.file){
      grab("file",()=>doc.file);
      grab("file.path",()=>doc.file.path);
      grab("file.name",()=>doc.file.name);
    }
  }catch(_){}
  return out;
}

(function(){
  let docs=[];
  try{docs=toArray(Document.all);}catch(_){}
  if(!docs.length&&Document.current) docs=[Document.current];
  if(!docs.length) throw new Error("Không có document đang mở.");

  const dump=docs.map(function(doc,docIndex){
    const nodes=toArray(doc.layers.all).filter(function(n){
      return n&&(n.isFrameTextNode||n.isArtTextNode);
    });

    return {
      docIndex,
      identity:identity(doc),
      nodeCount:nodes.length,
      nodes:nodes.map(function(node,nodeIndex){
        const text=getRawText(node);
        return {
          nodeIndex,
          isFrameTextNode:!!node.isFrameTextNode,
          isArtTextNode:!!node.isArtTextNode,
          length:text.length,
          text
        };
      })
    };
  });

  console.log("__PHONG_STRUCTURE_DUMP__"+JSON.stringify({documents:dump}));
})();
`;

    const result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);

    const output=getTextContent(result);
    const marker="__PHONG_STRUCTURE_DUMP__";
    const line=output.split(/\r?\n/).find(x=>x.includes(marker));
    if(!line) throw new Error("Affinity không trả structure dump.\n"+output);

    const payload=JSON.parse(line.slice(line.indexOf(marker)+marker.length));

    const outDir=path.join(__dirname,"diagnostics");
    fs.mkdirSync(outDir,{recursive:true});

    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    const outPath=path.join(outDir,`affinity-node-dump-${stamp}.json`);
    fs.writeFileSync(outPath,JSON.stringify(payload,null,2),"utf8");

    console.log("");
    console.log("DUMP XONG");
    console.log("Documents: "+payload.documents.length);
    console.log("File: "+outPath);
    console.log("");
    for(const d of payload.documents){
      console.log("Document "+(d.docIndex+1)+": "+(d.identity.title||d.identity.name||"(unnamed)"));
      console.log("  Text nodes: "+d.nodeCount);
    }
    console.log("");
    console.log("Gửi file JSON trong thư mục diagnostics cho ChatGPT.");
  }finally{
    try{await client.close();}catch(_){}
  }
}

main().catch(err=>{
  console.error("\nLỖI:");
  console.error(err?.stack||err?.message||String(err));
  process.exitCode=1;
});
