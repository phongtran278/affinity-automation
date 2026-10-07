import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const client=new Client({name:"phong-affinity-saveall-manifest",version:"2.0.0"});
const transport=new SSEClientTransport(new URL("http://localhost:6767/sse"));

function textOf(r){
  return (r?.content||[]).filter(x=>x&&x.type==="text").map(x=>x.text).join("\n");
}

try{
  await client.connect(transport);
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
  const current=Document.current||null;

  const rows=docs.map(function(d,i){
    let title="";
    try{title=String(d.title||d.name||("Document "+(i+1)));}catch(_){title="Document "+(i+1);}
    let isCurrent=false;
    try{isCurrent=current?d.isSameObject(current):false;}catch(_){isCurrent=d===current;}
    return {title:title,isCurrent:isCurrent};
  });

  rows.sort(function(a,b){
    return (a.isCurrent===b.isCurrent)?0:(a.isCurrent?-1:1);
  });

  console.log("__PHONG_SAVEALL_MANIFEST__"+JSON.stringify(rows));
})();
`;

  const result=await client.request({
    method:"tools/call",
    params:{name:"execute_script",arguments:{script}}
  },CallToolResultSchema);

  const output=textOf(result);
  const marker="__PHONG_SAVEALL_MANIFEST__";
  const line=output.split(/\r?\n/).find(x=>x.includes(marker));
  if(!line)throw new Error("Affinity không trả manifest document.");

  const rows=JSON.parse(line.slice(line.indexOf(marker)+marker.length));
  fs.writeFileSync(
    path.join(__dirname,"open-docs-save-manifest.json"),
    JSON.stringify(rows,null,2),
    "utf8"
  );
  process.stdout.write(String(rows.length));
} catch(e){
  console.error(e?.message||String(e));
  process.exitCode=1;
} finally {
  try{await client.close();}catch(_){}
}
