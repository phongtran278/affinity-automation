// Standalone layout mockup: no invoice graphics, amounts, or modification.
import fs from "node:fs";
import path from "node:path";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

export function renderPeriodLayoutPreview(items) {
  const entries=items.map((item, i) => {
    const name=escapeHtml(item.title);
    const message=escapeHtml(item.message);
    const widths=[320,480,640].map(width =>
      `<div class="sample"><small>Khung thử ${width}px</small><div class="message" style="max-width:${width}px">${message}</div></div>`
    ).join("");
    return `<section><h2>${i+1}. ${name}</h2><p class="date">Ngày sớm nhất: ${escapeHtml(item.startDate)} · ${escapeHtml(item.campaignCount)} chiến dịch</p>${widths}</section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>T7 V2 - Bản mẫu bố cục thông báo</title>
<style>
*{box-sizing:border-box}body{font:16px/1.55 system-ui,Arial,sans-serif;background:#f3f5f8;color:#172234;margin:0;padding:32px}
main{max-width:850px;margin:auto}.warning{padding:14px;border:2px solid #ac2332;color:#9f1728;font-weight:700;background:#fff3f3;border-radius:8px}
section{padding:24px;margin:20px 0;background:white;border-radius:12px;border:1px solid #dbe1ea}h2{font-size:18px;overflow-wrap:anywhere}
.date{color:#586575}.sample{margin-top:18px}small{display:block;color:#586575;margin-bottom:5px}
.message{padding:12px;background:#f8fafc;border:1px dashed #acbac9;overflow-wrap:anywhere}
footer{color:#586575;font-size:14px;margin-top:25px}
</style></head><body><main>
<h1>T7 V2 - Xem trước bố cục câu thông báo</h1>
<p class="warning">TEST - KHÔNG CÓ GIÁ TRỊ THANH TOÁN · BẢN MẪU ĐỘC LẬP</p>
<p>Thử xuống dòng ở 3 độ rộng. Đây không phải bản dựng chính xác vị trí, font hoặc kích cỡ của Affinity.</p>
${entries||"<p>Chưa có tài liệu đủ dữ liệu để tạo mẫu.</p>"}
<footer>Chỉ là tệp HTML xem trước. Không mở, chỉnh sửa hoặc lưu tài liệu Affinity.</footer>
</main></body></html>`;
}

export function writePeriodLayoutPreview(items, outputDir) {
  if (!items.length) return null;
  fs.mkdirSync(outputDir, {recursive:true});
  const output=path.join(outputDir,"t7-v2-message-layout-TEST.html");
  fs.writeFileSync(output,renderPeriodLayoutPreview(items),"utf8");
  return output;
}
