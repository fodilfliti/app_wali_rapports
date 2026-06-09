const PDFDocument = require("pdfkit");
const { buildHeaderModel } = require("../modules/rapports/tableLayoutService");
const { formatCellDisplay } = require("../modules/rapports/tableGridService");
const { audit } = require("./audit");
const {
  pickText,
  blockText,
  absFilePath,
  absPathFromUploadsUrl,
  loadExportData
} = require("./rapportExportData");
const { drawRichHtmlToPdf, resolveMediaFile } = require("./richHtmlExport");
const { tableNeedsPortraitPage } = require("./rapportExportTable");
const { registerPdfFonts, pdfTextOpts } = require("./exportFonts");
const { EXPORT_ELEMENT_MARGIN_V_PT } = require("./exportLayout");
const { rapportExportFilename } = require("./rapportExportFilename");

const MARGIN = 40;
const IMAGE_MAX_H = 220;

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

function drawMediaPair(doc, items, files, locale, fontName) {
  if (!items.length) return;

  const pageW = doc.page.width - MARGIN * 2;
  const gap = 12;
  const slotW = items.length === 1 ? pageW : (pageW - gap) / 2;
  let rowH = 0;
  const startY = doc.y;

  for (let i = 0; i < items.length; i += 1) {
    const file = files[items[i].file_id];
    const slotX = MARGIN + i * (slotW + (items.length > 1 ? gap : 0));

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
    doc.text(file.original_name, slotX, startY, pdfTextOpts(locale, { width: slotW, align: textAlign(locale) }));
    rowH = Math.max(rowH, 20);
  }

  doc.y = startY + rowH + 14;
  doc.x = MARGIN;
  doc.fillColor("#000000");
}

function drawMediaRow(doc, row, files, locale, fontName) {
  const items = row.items || [];
  for (let start = 0; start < items.length; start += 2) {
    drawMediaPair(doc, items.slice(start, start + 2), files, locale, fontName);
  }
}

function drawMediaImage(doc, fileId, src, files, locale, slotW, fontName) {
  const file = resolveMediaFile(fileId, src, files);
  let abs = file ? absFilePath(file) : null;
  if (!abs) abs = absPathFromUploadsUrl(src);
  const startY = doc.y;
  const isImage = !file || file.media_kind === "image" || /\.(jpe?g|png|gif|webp)$/i.test(abs || src || "");

  if (abs && isImage) {
    try {
      doc.image(abs, MARGIN, startY, { fit: [slotW, IMAGE_MAX_H], align: "center" });
      doc.y = startY + IMAGE_MAX_H + 14;
      doc.x = MARGIN;
      doc.fillColor("#000000");
      return;
    } catch {
      /* fall through */
    }
  }

  const label = file?.original_name || src || "";
  if (label) {
    doc.font(fontName).fontSize(9).fillColor("#64748b");
    doc.text(label, MARGIN, startY, pdfTextOpts(locale, { width: slotW, align: textAlign(locale) }));
    doc.y = startY + 24;
  }
  doc.x = MARGIN;
  doc.fillColor("#0f172a");
}

function drawRichDocument(doc, dataJson, files, locale, fontName, boldFontName) {
  const html = locale === "fr" ? dataJson.rich_html_fr : dataJson.rich_html_ar;
  if (html && String(html).trim()) {
    drawRichHtmlToPdf(doc, html, locale, fontName, {
      files,
      embeddedTables: dataJson.embedded_tables || [],
      ensureSpace,
      drawTable,
      drawMediaImage,
      startPortraitTablePage,
      tableNeedsPortraitPage,
      boldFontName,
      MARGIN
    });
  } else {
    drawDocumentBlocks(doc, dataJson.blocks, files, locale, fontName);
    for (const table of dataJson.embedded_tables || []) {
      const meta = table.table_meta || {};
      const title = pickText(meta, locale, "title_ar", "title_fr");
      if (title) {
        ensureSpace(doc, 40, fontName);
        doc.font(fontName).fontSize(14).text(title, { align: "center" });
        doc.moveDown(0.3);
      }
      drawTable(
        doc,
        table.columns || [],
        table.layout_json,
        meta,
        table.rows || [],
        locale,
        fontName
      );
    }
  }
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
        .text(txt, pdfTextOpts(locale, { align: block.align === "center" ? "center" : textAlign(locale) }));
      doc.moveDown(0.4);
    } else {
      ensureSpace(doc, 40, fontName);
      doc.font(fontName).fontSize(11).fillColor("#0f172a").text(txt, pdfTextOpts(locale, { align: textAlign(locale) }));
      doc.moveDown(0.6);
    }
  }
}

function startPortraitTablePage(doc) {
  const hasContent = doc.y > MARGIN + 8;
  if (hasContent) {
    doc.addPage({ size: "A4", layout: "portrait", margin: MARGIN });
  }
  doc.x = MARGIN;
}

function portraitPageOpts() {
  return { size: "A4", layout: "portrait", margin: MARGIN };
}

function drawTable(doc, columns, layoutJson, tableMeta, rows, locale, fontName) {
  const header = buildHeaderModel(columns, layoutJson, locale);
  const cols = header.columnRow;
  if (!cols.length) return;

  const dataRows = rows || [];
  const forcePortrait = tableNeedsPortraitPage(dataRows);
  if (forcePortrait) {
    startPortraitTablePage(doc);
  }

  const landscape = !forcePortrait && cols.length > 6;
  if (landscape) doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });

  const pageW = doc.page.width - MARGIN * 2;
  const colW = pageW / cols.length;
  const rowH = 16;
  const fontSize = cols.length > 10 ? 7 : cols.length > 7 ? 8 : 9;

  doc.y += EXPORT_ELEMENT_MARGIN_V_PT;
  doc.x = MARGIN;
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
      .text(
        String(text ?? ""),
        x + 2,
        cy + 3,
        pdfTextOpts(locale, { width: w - 4, height: h - 4, align: "center", ellipsis: true })
      );
  }

  function newPageIfNeeded(extra) {
    if (y + extra > doc.page.height - MARGIN) {
      if (forcePortrait) doc.addPage(portraitPageOpts());
      else if (landscape) doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
      else doc.addPage(portraitPageOpts());
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

  for (const row of dataRows) {
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

  doc.y = y + EXPORT_ELEMENT_MARGIN_V_PT;
  doc.x = MARGIN;
}

function renderPdfBuffer(data, locale) {
  const { rapport, kind, viewPart, dataJson, files } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pdfFonts = registerPdfFonts(doc, locale);
    const fontName = pdfFonts.regular;
    const boldFontName = pdfFonts.bold;
    doc.font(fontName);
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
      drawRichDocument(doc, dataJson, files, locale, fontName, boldFontName);
    }

    doc.end();
  });
}

async function generateRapportPdf(rapportId, { locale = "ar", showHidden = false, actor, req } = {}) {
  const loc = locale === "fr" ? "fr" : "ar";
  const data = await loadExportData(rapportId, showHidden);
  const buffer = await renderPdfBuffer(data, loc);
  await audit(actor?.id, "RAPPORT_PDF_EXPORT", { rapport_id: Number(rapportId), locale: loc }, { req });
  return { buffer, filename: rapportExportFilename(data.rapport, "pdf") };
}

module.exports = { generateRapportPdf };
