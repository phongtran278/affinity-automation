import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const client=new Client({name:"phong-t7-paid-diagnostic",version:"1.0.0"});
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
const { StoryIoFormat }=require("affinity:story");

function toArray(c){
  if(!c)return [];
  try{if(c.toArray)return c.toArray();}catch(_){}
  try{return Array.from(c);}catch(_){}
  return [];
}
function getRawText(node){
  try{return node.getText(0,-1,StoryIoFormat.Raw);}catch(_){}
  try{return node.story?node.story.getText(0,-1):"";}catch(_){}
  return "";
}
(function(){
  const doc=Document.current;
  if(!doc) throw new Error("Không có document đang active.");
  const nodes=toArray(doc.layers.all).filter(function(n){
    return n&&(n.isFrameTextNode||n.isArtTextNode);
  });
  const texts=nodes.map(getRawText);
  console.log("__PHONG_T7_PAID_DIAG__"+JSON.stringify({
    title:String(doc.title||""),
    path:String(doc.path||""),
    texts:texts.map(function(t,i){return {i:i,text:t};})
  }));
})();
`;

  const result=await client.request({
    method:"tools/call",
    params:{name:"execute_script",arguments:{script}}
  },CallToolResultSchema);

  const output=textOf(result);
  const marker="__PHONG_T7_PAID_DIAG__";
  const line=output.split(/\r?\n/).find(x=>x.includes(marker));
  if(!line)throw new Error("Affinity không trả diagnostic.\n"+output);
  const p=JSON.parse(line.slice(line.indexOf(marker)+marker.length));

  console.log("DOCUMENT: "+p.title);
  console.log("PATH: "+p.path);
  console.log("");
  console.log("=== TEXT NODES 0..25 ===");
  for(const x of p.texts.slice(0,26)){
    console.log("["+x.i+"] "+JSON.stringify(x.text));
  }
} catch(e){
  console.error("\nLỖI:");
  console.error(e?.stack||e?.message||String(e));
  process.exitCode=1;
} finally {
  try{await client.close();}catch(_){}
}
