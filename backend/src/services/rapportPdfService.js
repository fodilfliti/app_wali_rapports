const PDFDocument = require("pdfkit");
const { buildHeaderModel } = require("../modules/rapports/tableLayoutService");
const { formatCellDisplay } = require("../modules/rapports/tableGridService");
const { audit } = require("./audit");
const {
  pickText,
  blockText,
  absFilePath,
  loadExportData
} = require("./rapportExportData");

const MARGIN = 40;
const IMAGE_MAX_H = 220;

function resolveFontPath() {
  const fs = require("fs");
  const path = require("path");
  const winDir = process.env.WINDIR || "C:\\Windows";
  const fontsDir = path.join(winDir, "Fonts");
  for (const name of ["arial.ttf", "tahoma.ttf", "times.ttf", "calibri.ttf"]) {
    const p = path.join(fontsDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function registerBodyFont(doc) {
  const fp = resolveFontPath();
  if (fp) {
    try {
      doc.registerFont("body", fp);
      return "body";
    } catch {
      /* fall through */
    }
  }
  return "Helvetica";
}

function textAlign(locale) {
  return locale === "ar" ? "right" : "left";
}

function ensureSpace(doc, needed, fontName) {
  const limit = doc.page.height - MARGIN;
  if (doc.y + needed > limit) {
    doc.addPage();
    doc.font(fontName);
  }
}

function drawMediaRow(doc, row, files, locale, fontName) {
  const items = (row.items || []).slice(0, 2);
  if (!items.length) return;

  const pageW = doc.page.width - MARGIN * 2;
  const gap = 12;
  const slotW = (pageW - gap) / 2;
  let rowH = 0;
  const startY = doc.y;

  for (let i = 0; i < items.length; i += 1) {
    const file = files[items[i].file_id];
    const slotX = MARGIN + i * (slotW + gap);

    if (!file) continue;

    if (file.media_kind === "video") {
      const note =
        locale === "fr" ? "[Vidéo — non incluse dans le PDF]" : "[فيديو — غير مضمن في PDF]";
      doc.font(fontName).fontSize(9).fillColor("#64748b");
      doc.text(note, slotX, startY, { width: slotW, align: "center" });
      rowH = Math.max(rowH, 24);
      continue;
    }

    if (file.media_kind === "image") {
      const abs = absFilePath(file);
      if (abs) {
        try {
          doc.image(abs, slotX, startY, { fit: [slotW, IMAGE_MAX_H], align: "center" });
          rowH = Math.max(rowH, IMAGE_MAX_H);
        } catch {
          doc.font(fontName).fontSize(9).text(file.original_name, slotX, startY, { width: slotW });
          rowH = Math.max(rowH, 20);
        }
      }
      continue;
    }

    doc.font(fontName).fontSize(9).fillColor("#0f172a");
    doc.text(file.original_name, slotX, startY, { width: slotW, align: textAlign(locale) });
    rowH = Math.max(rowH, 20);
  }

  doc.y = startY + rowH + 14;
  doc.x = MARGIN;
  doc.fillColor("#000000");
}

function drawDocumentBlocks(doc, blocks, files, locale, fontName) {
  for (const block of blocks || []) {
    if (block.type === "media_row") {
      ensureSpace(doc, IMAGE_MAX_H + 20, fontName);
      drawMediaRow(doc, block, files, locale, fontName);
      continue;
    }

    const txt = blockText(block, locale);
    if (!txt && block.type !== "heading") continue;

    if (block.type === "heading") {
      ensureSpace(doc, 28, fontName);
      doc
        .font(fontName)
        .fontSize(16)
        .fillColor("#0f172a")
        .text(txt, { align: block.align === "center" ? "center" : textAlign(locale) });
      doc.moveDown(0.4);
    } else {
      ensureSpace(doc, 40, fontName);
      doc.font(fontName).fontSize(11).fillColor("#0f172a").text(txt, { align: textAlign(locale) });
      doc.moveDown(0.6);
    }
  }
}

function drawTable(doc, columns, layoutJson, tableMeta, rows, locale, fontName) {
  const header = buildHeaderModel(columns, layoutJson, locale);
  const cols = header.columnRow;
  if (!cols.length) return;

  const landscape = cols.length > 6;
  if (landscape) doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });

  const pageW = doc.page.width - MARGIN * 2;
  const colW = pageW / cols.length;
  const rowH = 16;
  const fontSize = cols.length > 10 ? 7 : cols.length > 7 ? 8 : 9;

  let y = doc.y;

  function drawCell(x, cy, w, h, text, opts = {}) {
    doc.rect(x, cy, w, h).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    if (opts.fill) {
      doc.save();
      doc.rect(x, cy, w, h).fillColor(opts.fill).fill();
      doc.restore();
      doc.rect(x, cy, w, h).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    }
    doc
      .font(fontName)
      .fontSize(fontSize)
      .fillColor("#0f172a")
      .text(String(text ?? ""), x + 2, cy + 3, { width: w - 4, height: h - 4, align: "center", ellipsis: true });
  }

  function newPageIfNeeded(extra) {
    if (y + extra > doc.page.height - MARGIN) {
      doc.addPage(landscape ? { size: "A4", layout: "landscape", margin: MARGIN } : undefined);
      y = MARGIN;
    }
  }

  if (header.hasGroupRow) {
    newPageIfNeeded(rowH);
    let x = MARGIN;
    for (const g of header.groupRow) {
      if (!g.label && g.colSpan === 1) {
        x += colW;
        continue;
      }
      drawCell(x, y, colW * g.colSpan, rowH, g.label, { fill: "#e2e8f0" });
      x += colW * g.colSpan;
    }
    y += rowH;
  }

  newPageIfNeeded(rowH);
  cols.forEach((c, i) => {
    drawCell(MARGIN + i * colW, y, colW, rowH, c.label, { fill: "#f1f5f9" });
  });
  y += rowH;

  for (const row of rows || []) {
    newPageIfNeeded(rowH);
    cols.forEach((c, i) => {
      const colDef = columns.find((col) => col.key === c.key);
      let val = row[c.key];
      if (colDef?.type === "commune_ref") {
        val = locale === "fr" ? row._municipality_name_fr : row._municipality_name_ar;
        val = val || row[c.key];
      } else if (colDef) {
        val = formatCellDisplay(val, colDef.format);
      }
      drawCell(MARGIN + i * colW, y, colW, rowH, val);
    });
    y += rowH;
  }

  doc.y = y + 10;
  doc.x = MARGIN;
}

function drawCalendarSection(doc, events, locale, fontName) {
  if (!events?.length) return;
  ensureSpace(doc, 30, fontName);
  doc
    .font(fontName)
    .fontSize(12)
    .fillColor("#0f172a")
    .text(locale === "fr" ? "Dates calendrier" : "تواريخ التقويم", { align: textAlign(locale) });
  doc.moveDown(0.3);
  for (const e of events) {
    ensureSpace(doc, 16, fontName);
    const title = pickText(e, locale, "title_ar", "title_fr");
    const note = pickText(e, locale, "note_ar", "note_fr");
    const line = note ? `${e.event_date} — ${title} (${note})` : `${e.event_date} — ${title}`;
    doc.font(fontName).fontSize(10).text(line, { align: textAlign(locale) });
  }
  doc.moveDown(0.5);
}

function renderPdfBuffer(data, locale) {
  const { rapport, kind, viewPart, files, calendarEvents } = data;
  const serviceName = pickText(rapport.service, locale, "name_ar", "name_fr");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontName = registerBodyFont(doc);
    doc.font(fontName);

    doc.fontSize(18).fillColor("#0f172a").text(rapport.title || "", { align: textAlign(locale) });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#64748b");
    if (serviceName) doc.text(serviceName, { align: textAlign(locale) });
    if (rapport.reference_date) doc.text(String(rapport.reference_date), { align: textAlign(locale) });
    doc.moveDown(0.8);
    doc.fillColor("#0f172a");

    if (kind === "table_grid") {
      const schema = viewPart.schema;
      const tableMeta = viewPart.tableMeta || {};
      const title = pickText(tableMeta, locale, "title_ar", "title_fr");
      const subtitle = pickText(tableMeta, locale, "subtitle_ar", "subtitle_fr");
      if (title) {
        doc.font(fontName).fontSize(14).text(title, { align: "center" });
        doc.moveDown(0.2);
      }
      if (subtitle) {
        doc.font(fontName).fontSize(10).fillColor("#64748b").text(subtitle, { align: "center" });
        doc.moveDown(0.5);
        doc.fillColor("#0f172a");
      }
      drawTable(doc, schema?.columns || [], schema?.layout_json, tableMeta, viewPart.rows, locale, fontName);
      for (const row of viewPart.media_rows || []) {
        drawMediaRow(doc, row, files, locale, fontName);
      }
    } else {
      drawDocumentBlocks(doc, viewPart.blocks, files, locale, fontName);
    }

    drawCalendarSection(doc, calendarEvents, locale, fontName);

    doc.end();
  });
}

async function generateRapportPdf(rapportId, { locale = "ar", showHidden = false, actor, req } = {}) {
  const loc = locale === "fr" ? "fr" : "ar";
  const data = await loadExportData(rapportId, showHidden);
  const buffer = await renderPdfBuffer(data, loc);
  await audit(actor?.id, "RAPPORT_PDF_EXPORT", { rapport_id: Number(rapportId), locale: loc }, { req });
  return { buffer, filename: `rapport-${rapportId}.pdf` };
}

module.exports = { generateRapportPdf };
