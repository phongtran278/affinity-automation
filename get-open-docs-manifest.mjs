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
  return (result?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}

async function main(){
  const client=new Client({name:"phong-affinity-open-docs-manifest",version:"1.0.0"});
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
function toArray(c){
  if(!c)return [];
  try{if(c.toArray)return c.toArray();}catch(_){}
  try{return Array.from(c);}catch(_){}
  return [];
}
(function(){
  let docs=[];
  try{docs=toArray(Document.all);}catch(_){}
  if(!docs.length&&Document.current)docs=[Document.current];
  const titles=docs.map(function(d,i){
    try{return String(d.title||d.name||("Document "+(i+1)));}catch(_){return "Document "+(i+1);}
  });
  console.log("__PHONG_OPEN_DOCS__"+JSON.stringify(titles));
})();
`;

    const result=await client.request({
      method:"tools/call",
      params:{name:"execute_script",arguments:{script}}
    },CallToolResultSchema);
    const output=getTextContent(result);
    const marker="__PHONG_OPEN_DOCS__";
    const line=output.split(/\r?\n/).find(x=>x.includes(marker));
    if(!line)throw new Error("Affinity khong tra danh sach document.\n"+output);
    const titles=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
    fs.writeFileSync(path.join(__dirname,"open-docs-save-manifest.txt"),titles.join("\r\n"),"utf8");
    console.log("Open documents: "+titles.length);
  }finally{
    try{await client.close();}catch(_){}
  }
}
main().catch(e=>{
  console.error(e?.stack||e?.message||String(e));
  process.exitCode=1;
});
