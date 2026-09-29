/**
 * name: Batch Export PDF High Quality
 * description: Export all open Affinity documents to a Desktop staging folder using the "PDF (digital - high quality)" preset.
 * version: 0.3.0
 * author: Phong Tran
 */

"use strict";

const { app } = require("/application");
const { Document, FileExportOptions, FileExportArea } = require("/document");
const { FileSystemApi } = require("/fs.js");

function toArray(collection) {
  if (!collection) return [];
  try { if (collection.toArray) return collection.toArray(); } catch (_) {}
  try { return Array.from(collection); } catch (_) {}
  return [];
}

function basenameWithoutExtension(name) {
  if (!name) return "Untitled";
  name = String(name);
  const slash = Math.max(name.lastIndexOf("\\"), name.lastIndexOf("/"));
  if (slash >= 0) name = name.substring(slash + 1);
  return name.replace(/\.[^.]+$/, "");
}

function getDocumentName(doc, index) {
  const candidates = ["title", "name", "fileName", "filename", "path", "filePath"];
  for (const key of candidates) {
    try {
      const value = doc[key];
      if (value) return basenameWithoutExtension(String(value));
    } catch (_) {}
  }
  return "Document_" + (index + 1);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeTimestamp() {
  const d = new Date();
  return (
    d.getFullYear() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "_" +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function joinPath(a, b) {
  if (!a) return b;
  const sep = a.endsWith("\\") || a.endsWith("/") ? "" : "\\";
  return a + sep + b;
}

function main() {
  try {
    let docs = [];
    try { docs = toArray(Document.all); } catch (_) {}

    if (!docs.length && Document.current) docs = [Document.current];

    if (!docs.length) {
      throw new Error("Không tìm thấy document nào đang mở.");
    }

    const desktop = app.userDesktopPath || app.getUserDesktopPath;
    if (!desktop) {
      throw new Error("Không lấy được đường dẫn Desktop.");
    }

    const stagingFolder = joinPath(
      String(desktop),
      "Affinity_PDF_Export_" + makeTimestamp()
    );

    FileSystemApi.createDirectories(stagingFolder);

    const pdfOptions = FileExportOptions.createWithPresetName(
      "PDF (digital - high quality)"
    );

    if (!pdfOptions) {
      throw new Error('Không tạo được preset "PDF (digital - high quality)".');
    }

    const exportArea = FileExportArea.createForWholeDocument();

    if (!exportArea) {
      throw new Error("Không tạo được Whole Document export area.");
    }

    let success = 0;
    let failed = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const name = getDocumentName(doc, i);
      const outputPath = joinPath(stagingFolder, name + ".pdf");

      try {
        doc.export(outputPath, pdfOptions, exportArea, null);
        success++;
      } catch (e) {
        failed.push(name + " → " + (e.message || String(e)));
      }
    }

    let message =
      "ĐÃ EXPORT XONG\n\n" +
      "Preset: PDF (digital - high quality)\n" +
      "Thành công: " + success + "/" + docs.length + "\n\n" +
      "File đang nằm tạm trên Desktop:\n" + stagingFolder + "\n\n" +
      "Bước tiếp theo: chạy move-exported-pdfs.bat để chọn folder đích bằng cửa sổ Windows.";

    if (failed.length) {
      message += "\n\nFILE LỖI:\n" + failed.join("\n");
    }

    app.alert(message, "Batch PDF Export");

  } catch (e) {
    app.alert(e.message || String(e), "Batch Export Error");
  }
}

main();
module.exports.main = main;
