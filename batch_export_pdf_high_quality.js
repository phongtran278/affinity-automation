/**
 * name: Batch Export PDF High Quality
 * description: Export all open Affinity documents to PDF using the "PDF (digital - high quality)" preset.
 * version: 0.1.0
 * author: Phong Tran
 */

"use strict";

const { app } = require("/application");
const {
  Document,
  FileExportOptions,
  FileExportArea
} = require("/document");


function toArray(collection) {
  if (!collection) return [];

  try {
    if (collection.toArray) {
      return collection.toArray();
    }
  } catch (_) {}

  try {
    return Array.from(collection);
  } catch (_) {}

  return [];
}


function getPickedPath(file) {
  if (!file) return null;

  if (typeof file === "string") {
    return file;
  }

  const candidates = [
    "path",
    "filePath",
    "fullPath",
    "nativePath",
    "filename"
  ];

  for (const key of candidates) {
    try {
      if (file[key]) {
        return String(file[key]);
      }
    } catch (_) {}
  }

  try {
    return String(file);
  } catch (_) {}

  return null;
}


function dirname(path) {
  if (!path) return null;

  path = path.replace(/\//g, "\\");

  const i = path.lastIndexOf("\\");

  if (i < 0) return null;

  return path.substring(0, i);
}


function basenameWithoutExtension(name) {
  if (!name) return "Untitled";

  name = String(name);

  const slash =
    Math.max(
      name.lastIndexOf("\\"),
      name.lastIndexOf("/")
    );

  if (slash >= 0) {
    name = name.substring(slash + 1);
  }

  return name.replace(/\.[^.]+$/, "");
}


function getDocumentName(doc, index) {
  const candidates = [
    "name",
    "title",
    "fileName",
    "filename",
    "path",
    "filePath"
  ];

  for (const key of candidates) {
    try {
      const value = doc[key];

      if (value) {
        return basenameWithoutExtension(
          String(value)
        );
      }
    } catch (_) {}
  }

  return "Document_" + (index + 1);
}


function main() {
  try {
    let docs = [];

    try {
      docs = toArray(Document.all);
    } catch (_) {}

    if (!docs.length && Document.current) {
      docs = [Document.current];
    }

    if (!docs.length) {
      throw new Error(
        "Không tìm thấy document nào đang mở."
      );
    }


    app.alert(
      "Đang mở " +
      docs.length +
      " document.\n\n" +

      "Hãy chọn MỘT FILE BẤT KỲ nằm trong folder muốn lưu PDF.\n\n" +

      "Script chỉ dùng file đó để xác định folder đích.\n" +
      "File được chọn sẽ KHÔNG bị sửa.",

      "Batch PDF Export"
    );


    const picked = app.chooseFile();

    if (!picked) {
      throw new Error(
        "Đã hủy chọn folder đích."
      );
    }


    const pickedPath = getPickedPath(picked);
    const outputFolder = dirname(pickedPath);

    if (!outputFolder) {
      throw new Error(
        "Không đọc được đường dẫn folder từ file đã chọn.\n\n" +
        "Path đọc được:\n" +
        String(pickedPath)
      );
    }


    const pdfOptions =
      FileExportOptions.createWithPresetName(
        "PDF (digital - high quality)"
      );

    if (!pdfOptions) {
      throw new Error(
        'Không tạo được preset "PDF (digital - high quality)".'
      );
    }


    const exportArea =
      FileExportArea.createForWholeDocument();

    if (!exportArea) {
      throw new Error(
        "Không tạo được Whole Document export area."
      );
    }


    let success = 0;
    let failed = [];


    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const name = getDocumentName(doc, i);

      const outputPath =
        outputFolder +
        "\\" +
        name +
        ".pdf";

      try {
        doc.export(
          outputPath,
          pdfOptions,
          exportArea,
          null
        );

        success++;

      } catch (e) {
        failed.push(
          name +
          " → " +
          (e.message || String(e))
        );
      }
    }


    let message =
      "XONG\n\n" +
      "Preset: PDF (digital - high quality)\n" +
      "Folder:\n" +
      outputFolder +
      "\n\n" +
      "Thành công: " +
      success +
      "/" +
      docs.length;


    if (failed.length) {
      message +=
        "\n\nFILE LỖI:\n" +
        failed.join("\n");
    }


    app.alert(
      message,
      "Batch PDF Export"
    );

  } catch (e) {
    app.alert(
      e.message || String(e),
      "Batch Export Error"
    );
  }
}


main();

module.exports.main = main;
