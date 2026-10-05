import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_URL = "http://localhost:6767/sse";

function chooseFolder() {
  try {
    const out = execFileSync("powershell.exe", [
      "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass",
      "-File", path.join(__dirname, "choose-folder.ps1")
    ], { encoding: "utf8", windowsHide: true });
    return String(out || "").trim();
  } catch {
    return "";
  }
}

function getTextContent(result) {
  return (result?.content || [])
    .filter((item) => item && item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function moveFileCrossDrive(source, target) {
  try {
    await fs.promises.rename(source, target);
  } catch (err) {
    if (err && err.code === "EXDEV") {
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
      await fs.promises.unlink(source);
      return;
    }
    throw err;
  }
}

async function main() {
  const destination = chooseFolder();
  if (!destination) process.exit(0);

  const client = new Client({ name: "phong-affinity-pdf-export-v2", version: "2.0.0" });
  const transport = new SSEClientTransport(new URL(SERVER_URL));

  try {
    await client.connect(transport);
  } catch (err) {
    throw new Error(
      "Không kết nối được Affinity MCP bridge. Hãy mở Affinity và đảm bảo MCP/Script Manager đang connected.\n" +
      (err?.message || String(err))
    );
  }

  try {
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
  } catch (err) {
    throw new Error(
      "Không đọc được Affinity MCP preamble.\n" +
      (err?.message || String(err))
    );
  }

  const stagingName = "Affinity_PDF_Export_V2_" + new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  const affinityScript = `
"use strict";
const { app } = require("/application");
const { Document, FileExportOptions, FileExportArea } = require("/document");
const { FileSystemApi } = require("/fs.js");
const { StoryIoFormat } = require("affinity:story");

function toArray(c){
  if(!c) return [];
  try{ if(c.toArray) return c.toArray(); }catch(_){}
  try{ return Array.from(c); }catch(_){}
  return [];
}

function allTextNodes(doc){
  return toArray(doc.layers.all).filter(function(n){
    return n && (n.isFrameTextNode || n.isArtTextNode);
  });
}

function getRawText(node){
  try{ return node.getText(0,-1,StoryIoFormat.Raw); }catch(_){}
  try{ return node.story ? node.story.getText(0,-1) : ""; }catch(_){}
  return "";
}

function getDocumentText(doc){
  return allTextNodes(doc).map(getRawText).join("\\n");
}

function pad2(n){ return String(n).padStart(2,"0"); }
function joinPath(a,b){ const sep=a.endsWith("\\\\")||a.endsWith("/")?"":"\\\\"; return a+sep+b; }

function parseInvoiceIdentity(doc){
  const full = getDocumentText(doc);

  let dateMatch = full.match(/Ngày lập hóa đơn\\/thanh toán\\s*[\\r\\n]+\\s*(\\d{1,2}):(\\d{2})\\s+(\\d{1,2})\\s+tháng\\s+(\\d{1,2}),\\s+(\\d{4})/i);
  if(!dateMatch){
    dateMatch = full.match(/(\\d{1,2}):(\\d{2})\\s+(\\d{1,2})\\s+tháng\\s+(\\d{1,2}),\\s+(\\d{4})/i);
  }

  let txMatch = full.match(/ID giao dịch\\s*[\\r\\n]+\\s*(\\d{10,}-\\d{10,})/i);
  if(!txMatch){
    txMatch = full.match(/\\b(\\d{10,}-\\d{10,})\\b/);
  }

  if(!dateMatch) throw new Error("Không đọc được Ngày lập hóa đơn/thanh toán trong document.");
  if(!txMatch) throw new Error("Không đọc được ID giao dịch trong document.");

  const hh = pad2(Number(dateMatch[1]));
  const mm = pad2(Number(dateMatch[2]));
  const dd = pad2(Number(dateMatch[3]));
  const month = pad2(Number(dateMatch[4]));
  const yyyy = String(dateMatch[5]);
  const transactionId = String(txMatch[1]);

  const filename = yyyy + "-" + month + "-" + dd + "T" + hh + "-" + mm +
    " Giao dịch số " + transactionId + ".pdf";

  return {
    filename,
    transactionId,
    invoiceDate: yyyy + "-" + month + "-" + dd + " " + hh + ":" + mm
  };
}

(function(){
  let docs=[];
  try{ docs=toArray(Document.all); }catch(_){}
  if(!docs.length && Document.current) docs=[Document.current];
  if(!docs.length) throw new Error("Không tìm thấy document nào đang mở.");

  const desktop=app.userDesktopPath||app.getUserDesktopPath;
  if(!desktop) throw new Error("Không lấy được Desktop path.");

  const stagingFolder=joinPath(String(desktop),${JSON.stringify(stagingName)});
  FileSystemApi.createDirectories(stagingFolder);

  const options=FileExportOptions.createWithPresetName("Phong Digital HQ 100");
  if(!options) throw new Error('Không tạo được preset "Phong Digital HQ 100".');

  const area=FileExportArea.createForWholeDocument();
  if(!area) throw new Error("Không tạo được Whole Document export area.");

  let success=0;
  const failed=[];
  const exported=[];
  const usedNames={};

  for(let i=0;i<docs.length;i++){
    const doc=docs[i];
    try{
      const info=parseInvoiceIdentity(doc);

      if(usedNames[info.filename]){
        throw new Error("Trùng tên output với document khác: " + info.filename);
      }
      usedNames[info.filename]=true;

      const out=joinPath(stagingFolder,info.filename);
      doc.export(out,options,area,null);
      success++;
      exported.push(info);
    }catch(e){
      failed.push("Document " + (i+1) + ": " + (e.message||String(e)));
    }
  }

  console.log("__PHONG_EXPORT_V2__"+JSON.stringify({
    stagingFolder,
    success,
    total:docs.length,
    failed,
    exported
  }));
})();
`;

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
  const marker = "__PHONG_EXPORT_V2__";
  const line = output.split(/\r?\n/).find((x) => x.includes(marker));

  if (!line) {
    throw new Error(
      "Affinity không trả về kết quả export V2.\n\n" +
      (output || "Không có output từ MCP.")
    );
  }

  const payload = JSON.parse(line.slice(line.indexOf(marker) + marker.length));
  if (!payload.stagingFolder) {
    throw new Error("Không nhận được staging folder từ Affinity.");
  }

  const pdfs = (await fs.promises.readdir(payload.stagingFolder))
    .filter((name) => name.toLowerCase().endsWith(".pdf"));

  let moved = 0;
  const skipped = [];

  for (const file of pdfs) {
    const source = path.join(payload.stagingFolder, file);
    const target = path.join(destination, file);

    if (fs.existsSync(target)) {
      skipped.push(file);
      continue;
    }

    await moveFileCrossDrive(source, target);
    moved++;
  }

  const remaining = await fs.promises.readdir(payload.stagingFolder).catch(() => []);
  if (!remaining.length) {
    await fs.promises.rmdir(payload.stagingFolder).catch(() => {});
  }

  console.log("");
  console.log("XONG - EXPORT V2");
  console.log("Preset: Phong Digital HQ 100");
  console.log("Công thức tên: YYYY-MM-DDTHH-mm Giao dịch số <Transaction ID>.pdf");
  console.log("Đã lưu: " + destination);
  console.log("Thành công: " + moved + "/" + payload.total);

  if (payload.exported?.length) {
    console.log("\nTên PDF đã tạo:");
    for (const x of payload.exported) {
      console.log("- " + x.filename);
    }
  }

  if (payload.failed?.length) {
    console.log("\nAffinity export lỗi / thiếu dữ liệu:");
    for (const x of payload.failed) {
      console.log("- " + x);
    }
  }

  if (skipped.length) {
    console.log("\nBỏ qua vì file đích đã tồn tại:");
    for (const x of skipped) {
      console.log("- " + x);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nLỖI:");
    console.error(err?.message || String(err));
    process.exit(1);
  });
