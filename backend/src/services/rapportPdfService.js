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
const {
  computeTableLayoutPolicy,
  pdfColumnWidths,
  pdfCellAlign,
  buildTableColumnSlots,
  tableColumnSpanRect,
  tableNeedsPortraitPage,
  estimateTableHeightPt,
  ensurePdfTablePage,
} = require("./tableLayoutPolicy");
const { registerPdfFonts, pdfTextOpts } = require("./exportFonts");
const { EXPORT_ELEMENT_MARGIN_V_PT } = require("./exportLayout");
const { metaLabel, communeNameCell, metaValuesForRow, exportMetaColumnKeys } = require("./tableExportMeta");
const { rapportExportFilename } = require("./rapportExportFilename");
const {
  getLatestWaliResponse,
  drawWaliResponseSectionPdf,
} = require("./waliResponseExport");

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
        fontName,
        { embedded: true },
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

function drawTable(
  doc,
  columns,
  layoutJson,
  tableMeta,
  rows,
  locale,
  fontName,
  opts = {},
) {
  const includeLineNumbers = opts.includeLineNumbers !== false;
  const includeAdminMeta = !!opts.includeAdminMeta;
  const includeCommuneNames = !!opts.includeCommuneNames;
  const header = buildHeaderModel(columns, layoutJson, locale);
  const cols = header.columnRow;
  if (!cols.length && !includeLineNumbers && !includeCommuneNames && !includeAdminMeta) return;

  const dataRows = rows || [];
  const metaKeys = exportMetaColumnKeys({ includeCommuneNames, includeAdminMeta });
  if (!includeLineNumbers) {
    const numIdx = metaKeys.indexOf("num");
    if (numIdx !== -1) metaKeys.splice(numIdx, 1);
  }
  const metaColCount = metaKeys.length;
  const policy = computeTableLayoutPolicy({
    columns: cols.map((c) => columns.find((col) => col.key === c.key) || { type: "text" }),
    rows: dataRows,
    dataColCount: cols.length,
    metaColCount,
    locale,
    embedded: !!opts.embedded,
    includeCommuneNames,
    includeLineNumbers,
    includeAdminMeta,
  });

  ensurePdfTablePage(
    doc,
    policy,
    estimateTableHeightPt(dataRows.length, header.hasGroupRow),
    MARGIN,
  );

  const landscape = policy.useLandscape;

  const pageW = doc.page.width - MARGIN * 2;
  const colWidths = pdfColumnWidths(pageW, policy);
  const slots = buildTableColumnSlots(colWidths, pageW, MARGIN, locale);
  const totalCols = policy.totalCols;
  const rowH = 16;
  const fontSize = policy.fontSize;

  doc.y += EXPORT_ELEMENT_MARGIN_V_PT;
  doc.x = MARGIN;
  let y = doc.y;

  function drawCell(x, cy, w, h, text, cellOpts = {}) {
    doc.rect(x, cy, w, h).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    if (cellOpts.fill) {
      doc.save();
      doc.rect(x, cy, w, h).fillColor(cellOpts.fill).fill();
      doc.restore();
      doc.rect(x, cy, w, h).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    }
    const cellAlign = cellOpts.center ? "center" : pdfCellAlign(locale);
    doc
      .font(fontName)
      .fontSize(fontSize)
      .fillColor("#0f172a")
      .text(
        String(text ?? ""),
        x + 2,
        cy + 3,
        pdfTextOpts(locale, {
          width: w - 4,
          height: h - 4,
          align: cellAlign,
          ellipsis: true,
        }),
      );
  }

  function drawCellAt(colIndex, cy, text, cellOpts = {}) {
    const slot = slots[colIndex];
    if (!slot) return;
    drawCell(slot.x, cy, slot.w, rowH, text, cellOpts);
  }

  function newPageIfNeeded(extra) {
    if (y + extra > doc.page.height - MARGIN) {
      if (landscape) doc.addPage({ size: "A4", layout: "landscape", margin: MARGIN });
      else doc.addPage(portraitPageOpts());
      y = MARGIN;
    }
  }

  if (header.hasGroupRow) {
    newPageIfNeeded(rowH);
    let colIndex = 0;
    metaKeys.forEach((key) => {
      drawCellAt(colIndex++, y, metaLabel(key, locale), { fill: "#e2e8f0", center: true });
    });
    for (const g of header.groupRow) {
      if (!g.label && g.colSpan === 1) {
        colIndex += 1;
        continue;
      }
      const { x, w } = tableColumnSpanRect(slots, colIndex, g.colSpan);
      drawCell(x, y, w, rowH, g.label, { fill: "#e2e8f0", center: true });
      colIndex += g.colSpan;
    }
    y += rowH;
  }

  newPageIfNeeded(rowH);
  let colIndex = 0;
  metaKeys.forEach((key) => {
    drawCellAt(colIndex++, y, metaLabel(key, locale), { fill: "#f1f5f9", center: true });
  });
  cols.forEach((c) => {
    drawCellAt(colIndex++, y, c.label, { fill: "#f1f5f9", center: true });
  });
  y += rowH;

  dataRows.forEach((row, rIdx) => {
    newPageIfNeeded(rowH);
    colIndex = 0;
    if (includeCommuneNames) {
      drawCellAt(colIndex++, y, communeNameCell(row, locale));
    }
    if (metaKeys.length) {
      const meta = metaValuesForRow(row, rIdx + 1, { includeAdminMeta });
      for (const key of metaKeys) {
        if (key === "commune") continue;
        drawCellAt(colIndex++, y, meta[key] ?? "", { center: true });
      }
    }
    cols.forEach((c) => {
      const colDef = columns.find((col) => col.key === c.key);
      let val = row[c.key];
      if (colDef?.type === "commune_ref") {
        val = locale === "fr" ? row._municipality_name_fr : row._municipality_name_ar;
        val = val || row[c.key];
      } else if (colDef) {
        val = formatCellDisplay(val, colDef.format);
      }
      drawCellAt(colIndex++, y, val);
    });
    y += rowH;
  });

  void tableMeta;
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
      drawTable(
        doc,
        schema?.columns || [],
        schema?.layout_json,
        tableMeta,
        viewPart.rows,
        locale,
        fontName,
        { includeLineNumbers: true, includeAdminMeta: false },
      );
      for (const row of viewPart.media_rows || []) {
        drawMediaRow(doc, row, files, locale, fontName);
      }
    } else if (kind === "commune_list") {
      const table = dataJson.tables?.[0];
      if (table?.rows?.length) {
        const title = pickText(table, locale, "title_ar", "title_fr") || pickText(rapport, locale, "title_ar", "title_fr");
        if (title) {
          doc.font(fontName).fontSize(14).text(title, { align: "center" });
          doc.moveDown(0.2);
        }
        drawTable(
          doc,
          viewPart.columns || [],
          viewPart.layoutJson,
          {},
          table.rows,
          locale,
          fontName,
          { includeLineNumbers: true, includeAdminMeta: false, includeCommuneNames: true },
        );
      }
    } else {
      drawRichDocument(doc, dataJson, files, locale, fontName, boldFontName);
      for (const row of dataJson.media_rows || []) {
        drawMediaRow(doc, row, files, locale, fontName);
      }
      if (kind === "fiche_lecture") {
        const waliResponse = getLatestWaliResponse(rapport.waliResponses);
        drawWaliResponseSectionPdf(doc, waliResponse, locale, fontName, boldFontName, {
          margin: MARGIN,
          ensureSpace,
        });
      }
    }

    doc.end();
  });
}

async function generateRapportPdf(rapportId, { locale = "ar", showHidden = false, versionId = null, actor, req } = {}) {
  const loc = locale === "fr" ? "fr" : "ar";
  const data = await loadExportData(rapportId, showHidden, versionId);
  const buffer = await renderPdfBuffer(data, loc);
  await audit(actor?.id, "RAPPORT_PDF_EXPORT", { rapport_id: Number(rapportId), locale: loc }, { req });
  return { buffer, filename: rapportExportFilename(data.rapport, "pdf") };
}

module.exports = { generateRapportPdf };
