import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_URL = "http://localhost:6767/sse";
const LOG_PATH = path.join(__dirname, "probe-pdf-options.log");

function getTextContent(result) {
  return (result?.content || [])
    .filter((item) => item && item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function main() {
  const client = new Client({ name: "phong-affinity-pdf-probe", version: "1.0.0" });
  const transport = new SSEClientTransport(new URL(SERVER_URL));

  await client.connect(transport);

  await client.request(
    {
      method: "tools/call",
      params: {
        name: "read_sdk_documentation_topic",
        arguments: { filename: "preamble" }
      }
    },
    CallToolResultSchema
  );

  const affinityScript = [
    '"use strict";',
    'const { FileExportOptions } = require("/document");',
    'function collectKeys(obj){',
    '  const out=[];',
    '  const seen=new Set();',
    '  let cur=obj;',
    '  let depth=0;',
    '  while(cur && depth<8){',
    '    let names=[];',
    '    try{ names=Object.getOwnPropertyNames(cur); }catch(_){}',
    '    for(const n of names){ if(!seen.has(n)){ seen.add(n); out.push(n); } }',
    '    try{ cur=Object.getPrototypeOf(cur); }catch(_){ cur=null; }',
    '    depth++;',
    '  }',
    '  return out.sort();',
    '}',
    'function safeRead(obj,key){',
    '  try{',
    '    const v=obj[key];',
    '    if(typeof v==="function") return "[function]";',
    '    if(v===undefined) return "[undefined]";',
    '    if(v===null) return "[null]";',
    '    if(typeof v==="object"){',
    '      try{return JSON.stringify(v);}catch(_){return Object.prototype.toString.call(v);}',
    '    }',
    '    return String(v);',
    '  }catch(e){ return "[READ ERROR] "+(e.message||String(e)); }',
    '}',
    '(function(){',
    '  const presetName="PDF (digital - high quality)";',
    '  const opt=FileExportOptions.createWithPresetName(presetName);',
    '  const keys=collectKeys(opt);',
    '  const interesting=/dpi|quality|compress|compression|downsample|raster|jpeg|image|resample|resolution|embed|font|subset|profile|color|colour|pdf|compat|lossless|bitmap/i;',
    '  const lines=[];',
    '  lines.push("PDF EXPORT OPTIONS PROBE");',
    '  lines.push("Preset: "+presetName);',
    '  lines.push("");',
    '  lines.push("=== INTERESTING PROPERTIES ===");',
    '  for(const k of keys){ if(interesting.test(k)) lines.push(k+" = "+safeRead(opt,k)); }',
    '  lines.push("");',
    '  lines.push("=== ALL KEYS ===");',
    '  for(const k of keys) lines.push(k+" = "+safeRead(opt,k));',
    '  console.log("__PHONG_PDF_OPTIONS__"+JSON.stringify({presetName,keys,lines}));',
    '})();'
  ].join("\n");

  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "execute_script",
        arguments: { script: affinityScript }
      }
    },
    CallToolResultSchema
  );

  const output = getTextContent(result);
  const marker = "__PHONG_PDF_OPTIONS__";
  const line = output.split(/\r?\n/).find((x) => x.includes(marker));

  if (!line) {
    const fallback = [
      "Không lấy được payload probe từ Affinity.",
      "",
      "Raw MCP output:",
      output || "(empty)"
    ].join("\n");
    fs.writeFileSync(LOG_PATH, fallback, "utf8");
    throw new Error(fallback);
  }

  const payload = JSON.parse(line.slice(line.indexOf(marker) + marker.length));
  fs.writeFileSync(LOG_PATH, payload.lines.join("\n"), "utf8");

  console.log("XONG");
  console.log("Đã ghi kết quả probe vào:");
  console.log(LOG_PATH);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    const msg = err?.stack || err?.message || String(err);
    try { fs.writeFileSync(LOG_PATH, msg, "utf8"); } catch {}
    console.error(msg);
    process.exit(1);
  });
