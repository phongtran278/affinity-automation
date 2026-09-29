/**
 * name: Batch Export PDF High Quality
 * description: Export all open Affinity documents to an output folder using the "PDF (digital - high quality)" preset.
 * version: 0.2.0
 * author: Phong Tran
 */

"use strict";

const { app } = require("/application");
const {
  Document,
  FileExportOptions,
  FileExportArea
} = require("/document");
const { FileSystemApi } = require("/fs.js");


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


function basenameWithoutExtension(name) {
  if (!name) return "Untitled";

  name = String(name);

  const slash = Math.max(
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
    "title",
    "name",
    "fileName",
    "filename",
    "path",
    "filePath"
  ];

  for (const key of candidates) {
    try {
      const value = doc[key];
      if (value) {
        return basenameWithoutExtension(String(value));
      }
    } catch (_) {}
  }

  return "Document_" + (index + 1);
}


function normalizeFolderPath(path) {
  if (!path) return "";

  let value = String(path).trim();

  if (
    value.length >= 2 &&
    (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
  ) {
    value = value.slice(1, -1).trim();
  }

  while (
    value.length > 3 &&
    (value.endsWith("\\") || value.endsWith("/"))
  ) {
    value = value.slice(0, -1);
  }

  return value;
}


function ensureOutputFolder(path) {
  let exists = false;

  try {
    exists = !!FileSystemApi.exists(path);
  } catch (_) {
    exists = false;
  }

  if (!exists) {
    FileSystemApi.createDirectories(path);
    return;
  }

  if (!FileSystemApi.isDirectory(path)) {
    throw new Error(
      "Đường dẫn output không phải là folder:\n" + path
    );
  }

  let isEmpty = true;

  try {
    isEmpty = !!FileSystemApi.isEmpty(path);
  } catch (_) {}

  if (!isEmpty) {
    const continueExport = app.confirm(
      "Folder này đang có file bên trong.\n\n" +
      path +
      "\n\n" +
      "Vẫn tiếp tục export vào đây?",
      "Folder không trống"
    );

    if (!continueExport) {
      throw new Error("Đã hủy export.");
    }
  }
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


    const defaultFolder = "D:\\PHONG_LAB\\PDF_OUTPUT";

    const enteredFolder = app.prompt(
      "Nhập đường dẫn folder muốn xuất PDF.\n\n" +
      "• Có thể nhập một folder trống đã có sẵn.\n" +
      "• Hoặc nhập tên folder mới, script sẽ tự tạo.\n" +
      "• Nếu folder đã có file, script sẽ hỏi lại trước khi export.",
      "Batch PDF Export",
      defaultFolder
    );

    if (enteredFolder === null || enteredFolder === undefined) {
      return;
    }

    const outputFolder = normalizeFolderPath(enteredFolder);

    if (!outputFolder) {
      throw new Error("Chưa nhập folder output.");
    }

    ensureOutputFolder(outputFolder);


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
