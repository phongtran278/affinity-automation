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

  const client = new Client({ name: "phong-affinity-pdf-export", version: "1.0.0" });
  const transport = new SSEClientTransport(new URL(SERVER_URL));

  try {
    await client.connect(transport);
  } catch (err) {
    throw new Error("Không kết nối được Affinity MCP bridge. Hãy mở Affinity và đảm bảo MCP/Script Manager đang connected.\n" + (err?.message || String(err)));
  }

  // Affinity MCP requires the SDK preamble to be read once per session
  // before other script/tool calls are accepted.
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

  const stagingName = "Affinity_PDF_Export_" + new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  const affinityScript = [
    "\"use strict\";",
    "const { app } = require(\"/application\");",
    "const { Document, FileExportOptions, FileExportArea } = require(\"/document\");",
    "const { FileSystemApi } = require(\"/fs.js\");",
    "function toArray(c){ if(!c)return []; try{if(c.toArray)return c.toArray();}catch(_){} try{return Array.from(c);}catch(_){} return [];}",
    "function baseName(n){ n=String(n||\"Untitled\"); const s=Math.max(n.lastIndexOf(\"\\\\\"),n.lastIndexOf(\"/\")); if(s>=0)n=n.substring(s+1); return n.replace(/\\.[^.]+$/,\"\"); }",
    'function cleanName(n){ return baseName(n).replace(/[<>:\"/\\\\|?*\\x00-\\x1F]/g,\"_\").trim()||\"Untitled\"; }',
    "function docName(d,i){ const k=[\"title\",\"name\",\"fileName\",\"filename\",\"path\",\"filePath\"]; for(const x of k){ try{const v=d[x]; if(v)return cleanName(String(v));}catch(_){}} return \"Document_\"+(i+1); }",
    "function joinPath(a,b){ const sep=a.endsWith(\"\\\\\")||a.endsWith(\"/\")?\"\":\"\\\\\"; return a+sep+b; }",
    "(function(){",
    " let docs=[]; try{docs=toArray(Document.all);}catch(_){} if(!docs.length&&Document.current)docs=[Document.current];",
    " if(!docs.length) throw new Error(\"Không tìm thấy document nào đang mở.\");",
    " const desktop=app.userDesktopPath||app.getUserDesktopPath; if(!desktop) throw new Error(\"Không lấy được Desktop path.\");",
    " const stagingFolder=joinPath(String(desktop),"+JSON.stringify(stagingName)+");",
    " FileSystemApi.createDirectories(stagingFolder);",
    " const options=FileExportOptions.createWithPresetName(\"Phong Digital HQ 100\");",
    " const area=FileExportArea.createForWholeDocument();",
    " let success=0; const failed=[];",
    " for(let i=0;i<docs.length;i++){ const name=docName(docs[i],i); const out=joinPath(stagingFolder,name+\".pdf\"); try{docs[i].export(out,options,area,null); success++;}catch(e){failed.push(name+\": \"+(e.message||String(e)));}}",
    " console.log(\"__PHONG_EXPORT__\"+JSON.stringify({stagingFolder,success,total:docs.length,failed}));",
    "})();"
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
  const marker = "__PHONG_EXPORT__";
  const line = output.split(/\r?\n/).find((x) => x.includes(marker));
  if (!line) throw new Error("Affinity không trả về kết quả export.\n\n" + (output || "Không có output từ MCP."));

  const payload = JSON.parse(line.slice(line.indexOf(marker) + marker.length));
  if (!payload.stagingFolder) throw new Error("Không nhận được staging folder từ Affinity.");

  const pdfs = (await fs.promises.readdir(payload.stagingFolder)).filter((name) => name.toLowerCase().endsWith(".pdf"));
  let moved = 0;
  const skipped = [];

  for (const file of pdfs) {
    const source = path.join(payload.stagingFolder, file);
    const target = path.join(destination, file);
    if (fs.existsSync(target)) { skipped.push(file); continue; }
    await moveFileCrossDrive(source, target);
    moved++;
  }

  const remaining = await fs.promises.readdir(payload.stagingFolder).catch(() => []);
  if (!remaining.length) await fs.promises.rmdir(payload.stagingFolder).catch(() => {});

  console.log("");
  console.log("XONG");
  console.log("Preset: Phong Digital HQ 100");
  console.log("Đã lưu: " + destination);
  console.log("Thành công: " + moved + "/" + payload.total);
  if (payload.failed?.length) { console.log("\nAffinity export lỗi:"); for (const x of payload.failed) console.log("- " + x); }
  if (skipped.length) { console.log("\nBỏ qua vì trùng tên:"); for (const x of skipped) console.log("- " + x); }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nLỖI:");
    console.error(err?.message || String(err));
    process.exit(1);
  });
