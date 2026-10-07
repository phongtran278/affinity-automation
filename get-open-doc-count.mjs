import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const client=new Client({name:"phong-affinity-open-doc-count",version:"1.0.0"});
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
  console.log("__COUNT__"+docs.length);
})();
`;

  const result=await client.request({
    method:"tools/call",
    params:{name:"execute_script",arguments:{script}}
  },CallToolResultSchema);

  const out=textOf(result);
  const m=out.match(/__COUNT__(\d+)/);
  if(!m)throw new Error("Không đọc được số document đang mở.");
  process.stdout.write(m[1]);
} catch(e){
  console.error(e?.message||String(e));
  process.exitCode=1;
} finally {
  try{await client.close();}catch(_){}
}
