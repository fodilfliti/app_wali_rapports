const { parse } = require("node-html-parser");
const {
  EXPORT_ELEMENT_MARGIN_V_PT,
  EXPORT_BLOCK_PAD_V_PT,
  EXPORT_BLOCK_PAD_H_PT,
  marginTwip
} = require("./exportLayout");
const { pdfTextOpts } = require("./exportFonts");
const { buildTableColumnSlots } = require("./tableLayoutPolicy");

function elTag(el) {
  return String(el?.rawTagName || el?.tagName || "").toLowerCase();
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseInlineStyle(styleStr) {
  const out = {};
  if (!styleStr) return out;
  for (const chunk of styleStr.split(";")) {
    const idx = chunk.indexOf(":");
    if (idx < 0) continue;
    const key = chunk.slice(0, idx).trim().toLowerCase();
    const val = chunk.slice(idx + 1).trim();
    if (key === "color") out.color = normalizeColor(val);
    if (key === "font-size") out.fontSize = val;
    if (key === "text-align") out.textAlign = val;
  }
  return out;
}

function normalizeColor(val) {
  if (!val) return null;
  const v = val.trim().toLowerCase();
  if (v.startsWith("#")) return v.length === 4 ? expandShortHex(v) : v;
  if (v.startsWith("rgb")) {
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const hex = (n) => Number(m[n]).toString(16).padStart(2, "0");
      return `#${hex(1)}${hex(2)}${hex(3)}`;
    }
  }
  return val;
}

function expandShortHex(hex) {
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function pxToPt(px) {
  const n = parseFloat(String(px || ""));
  if (Number.isNaN(n)) return 11;
  return Math.max(8, Math.min(36, Math.round(n * 0.75)));
}

function pxToDocxSize(px) {
  const n = parseFloat(String(px || ""));
  if (Number.isNaN(n)) return 22;
  return Math.max(16, Math.min(64, Math.round(n * 1.5)));
}

function mergeCtx(ctx, el) {
  const style = parseInlineStyle(el.getAttribute?.("style") || "");
  const alignAttr = el.getAttribute?.("align");
  const next = { ...ctx, ...style };
  if (alignAttr) next.textAlign = alignAttr;
  return next;
}

function collectRuns(node, inherited = {}) {
  const runs = [];

  function walk(n, ctx) {
    if (n.nodeType === 3) {
      const text = decodeEntities(n.rawText);
      if (text) runs.push({ text, ...ctx });
      return;
    }
    if (n.nodeType !== 1) return;

    const tag = elTag(n);
    let next = mergeCtx(ctx, n);
    if (tag === "strong" || tag === "b") next = { ...next, bold: true };
    if (tag === "em" || tag === "i") next = { ...next, italic: true };
    if (tag === "u") next = { ...next, underline: true };
    if (tag === "s" || tag === "strike" || tag === "del") next = { ...next, strike: true };

    if (tag === "br") {
      runs.push({ text: "\n", ...ctx, lineBreak: true });
      return;
    }

    for (const child of n.childNodes) walk(child, next);
  }

  walk(node, inherited);
  return runs;
}

function normalizeAlign(align, locale) {
  const a = String(align || "").toLowerCase();
  if (a === "center") return "center";
  if (a === "left") return "left";
  if (a === "right") return "right";
  if (a === "justify") return "justify";
  if (a === "start") return locale === "ar" ? "right" : "left";
  if (a === "end") return locale === "ar" ? "left" : "right";
  return null;
}

function blockAlign(el, locale) {
  const style = parseInlineStyle(el.getAttribute?.("style") || "");
  const alignAttr = el.getAttribute?.("align");
  const fromStyle = normalizeAlign(style.textAlign, locale);
  if (fromStyle) return fromStyle;
  const fromAttr = normalizeAlign(alignAttr, locale);
  if (fromAttr) return fromAttr;
  return locale === "ar" ? "right" : "left";
}

function parseHtmlTable(el, locale) {
  const rows = [];
  for (const tr of el.querySelectorAll("tr")) {
    const cells = [];
    for (const cell of tr.querySelectorAll("th, td")) {
      cells.push({
        header: elTag(cell) === "th",
        runs: collectRuns(cell),
        align: blockAlign(cell, locale)
      });
    }
    if (cells.length) rows.push(cells);
  }
  return rows.length ? { type: "html_table", rows } : null;
}

function walkBlockContainer(parent, locale) {
  const blocks = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === 3) {
      const text = decodeEntities(child.rawText).trim();
      if (text) {
        blocks.push({
          type: "paragraph",
          align: locale === "ar" ? "right" : "left",
          runs: [{ text }]
        });
      }
      continue;
    }
    if (child.nodeType !== 1) continue;
    const parsed = parseBlockElement(child, locale);
    if (Array.isArray(parsed)) blocks.push(...parsed);
    else if (parsed) blocks.push(parsed);
  }
  return blocks;
}

function parseBlockElement(el, locale) {
  const tag = elTag(el);
  if (!tag) return null;

  if (tag === "p") {
    const runs = collectRuns(el);
    if (!runs.length) return { type: "spacer" };
    return { type: "paragraph", align: blockAlign(el, locale), runs };
  }

  if (/^h[1-3]$/.test(tag)) {
    const runs = collectRuns(el);
    if (!runs.length) return null;
    return { type: "heading", level: Number(tag[1]), align: blockAlign(el, locale), runs };
  }

  if (tag === "blockquote") {
    return { type: "blockquote", children: walkBlockContainer(el, locale) };
  }

  if (tag === "ul" || tag === "ol") {
    const items = [];
    for (const li of el.childNodes.filter((c) => elTag(c) === "li")) {
      const blockChildren = li.childNodes.filter(
        (c) =>
          c.nodeType === 1 &&
          ["p", "h1", "h2", "h3", "div", "ul", "ol", "blockquote"].includes(elTag(c))
      );
      if (blockChildren.length) {
        items.push({ runs: [], nested: walkBlockContainer(li, locale) });
      } else {
        items.push({ runs: collectRuns(li), nested: [] });
      }
    }
    return items.length ? { type: "list", ordered: tag === "ol", items } : null;
  }

  if (tag === "hr") return { type: "hr" };

  if (tag === "img") {
    return {
      type: "image",
      fileId: el.getAttribute("data-file-id") ? Number(el.getAttribute("data-file-id")) : null,
      src: el.getAttribute("src")
    };
  }

  if (tag === "video") {
    return {
      type: "video",
      fileId: el.getAttribute("data-file-id") ? Number(el.getAttribute("data-file-id")) : null
    };
  }

  if (tag === "table") return parseHtmlTable(el, locale);

  if (tag === "div") {
    const cls = el.getAttribute("class") || "";
    if (cls.includes("schema-table-embed") || el.getAttribute("data-schema-table-id")) {
      return { type: "schema_table_ref", tableId: el.getAttribute("data-schema-table-id") };
    }
    if (cls.includes("editor-bordered-block")) {
      return { type: "bordered", children: walkBlockContainer(el, locale) };
    }
    return walkBlockContainer(el, locale);
  }

  return null;
}

function parseRichHtml(html, locale) {
  if (!html || !String(html).trim()) return [];
  const wrapped = parse(`<div class="rich-export-root">${html}</div>`, {
    blockTextElements: { script: true, style: true, noscript: true }
  });
  const root = wrapped.querySelector(".rich-export-root") || wrapped;
  return walkBlockContainer(root, locale);
}

function resolveMediaFile(fileId, src, files) {
  if (fileId && files?.[fileId]) return files[fileId];
  if (!src || !files) return null;
  const normalized = String(src).replace(/^https?:\/\/[^/]+/i, "");
  for (const file of Object.values(files)) {
    if (!file?.storage_rel_path) continue;
    if (normalized.includes(file.storage_rel_path)) return file;
    if (file.url_path && normalized.includes(file.url_path)) return file;
  }
  return null;
}

function findEmbeddedTable(embeddedTables, tableId) {
  if (!tableId || !embeddedTables?.length) return null;
  return embeddedTables.find((t) => String(t.id) === String(tableId)) || null;
}

function collectSchemaTableIds(blocks) {
  const ids = new Set();
  for (const b of blocks) {
    if (b.type === "schema_table_ref" && b.tableId) ids.add(String(b.tableId));
    if (b.type === "bordered") {
      for (const id of collectSchemaTableIds(b.children || [])) ids.add(id);
    }
  }
  return ids;
}

function appendUnusedEmbeddedTables(blocks, embeddedTables) {
  const used = collectSchemaTableIds(blocks);
  const tail = (embeddedTables || [])
    .filter((t) => t?.id != null && !used.has(String(t.id)))
    .map((t) => ({ type: "embedded_table", table: t }));
  return [...blocks, ...tail];
}

function pdfAlign(align, locale) {
  const normalized = normalizeAlign(align, locale);
  if (normalized) return normalized;
  return locale === "ar" ? "right" : "left";
}

function headingBaseSize(level) {
  if (level === 1) return 20;
  if (level === 2) return 16;
  return 14;
}

function drawPdfArabicLine(doc, lineRuns, { fontName, boldFontName, baseSize, lineAlign, left, width, locale }) {
  const text = lineRuns.map((r) => r.text).join("");
  if (!text) return;
  const bold = lineRuns.some((r) => r.bold);
  const underline = lineRuns.some((r) => r.underline);
  const sized = lineRuns.find((r) => r.fontSize);
  const color = lineRuns.find((r) => r.color)?.color || "#0f172a";
  const size = sized?.fontSize ? pxToPt(sized.fontSize) : baseSize;
  doc
    .font(bold && boldFontName ? boldFontName : fontName)
    .fontSize(size)
    .fillColor(color);
  doc.text(text, left, doc.y, pdfTextOpts(locale, { width, align: lineAlign, underline }));
}

function drawPdfRuns(doc, runs, { fontName, boldFontName, baseSize, align, locale, width, margin }) {
  const lineAlign = pdfAlign(align, locale);
  const left = margin;
  const lines = [];
  let currentLine = [];

  for (const r of runs) {
    if (r.lineBreak) {
      lines.push(currentLine);
      currentLine = [];
      continue;
    }
    if (r.text) currentLine.push(r);
  }
  lines.push(currentLine);

  for (const lineRuns of lines) {
    if (!lineRuns.length) {
      doc.moveDown(0.35);
      continue;
    }
    doc.x = left;

    if (locale === "ar") {
      drawPdfArabicLine(doc, lineRuns, { fontName, boldFontName, baseSize, lineAlign, left, width, locale });
      doc.moveDown(0.45);
      continue;
    }

    const y = doc.y;
    for (let i = 0; i < lineRuns.length; i += 1) {
      const r = lineRuns[i];
      const size = r.fontSize ? pxToPt(r.fontSize) : baseSize;
      const face = r.bold && boldFontName ? boldFontName : fontName;
      doc.font(face).fontSize(size).fillColor(r.color || "#0f172a");
      doc.text(r.text, left, y, {
        width,
        align: lineAlign,
        underline: !!r.underline,
        continued: i < lineRuns.length - 1
      });
    }
    doc.text("", { continued: false });
    doc.moveDown(0.45);
  }
}

function drawRichHtmlToPdf(doc, html, locale, fontName, helpers) {
  const {
    files,
    embeddedTables,
    ensureSpace,
    drawTable,
    drawMediaImage,
    startPortraitTablePage,
    tableNeedsPortraitPage,
    boldFontName,
    MARGIN
  } = helpers;
  const blocks = appendUnusedEmbeddedTables(parseRichHtml(html, locale), embeddedTables);
  const width = doc.page.width - MARGIN * 2;
  const runOpts = { fontName, boldFontName: boldFontName || fontName, locale, width, margin: MARGIN };

  for (const block of blocks) {
    if (block.type === "spacer") {
      doc.moveDown(0.3);
      continue;
    }

    if (block.type === "paragraph" || block.type === "heading") {
      const baseSize = block.type === "heading" ? headingBaseSize(block.level) : 11;
      ensureSpace(doc, baseSize + 20, fontName);
      if (block.type === "heading") {
        for (const r of block.runs) r.bold = true;
      }
      drawPdfRuns(doc, block.runs, { ...runOpts, baseSize, align: block.align });
      continue;
    }

    if (block.type === "list") {
      block.items.forEach((item, idx) => {
        ensureSpace(doc, 24, fontName);
        const bullet = block.ordered ? `${idx + 1}. ` : "• ";
        const runs = [{ text: bullet, bold: true }, ...(item.runs || [])];
        drawPdfRuns(doc, runs, { ...runOpts, baseSize: 11, align: block.align || (locale === "ar" ? "right" : "left") });
        for (const nested of item.nested || []) {
          drawRichHtmlBlockToPdf(doc, nested, locale, fontName, { ...helpers, width, indent: 16 });
        }
      });
      continue;
    }

    if (block.type === "blockquote") {
      ensureSpace(doc, 30, fontName);
      const x = doc.x;
      const y = doc.y;
      doc.save();
      doc.rect(MARGIN, y, 3, 20).fillColor("#94a3b8").fill();
      doc.restore();
      doc.x = MARGIN + 10;
      for (const child of block.children || []) {
        drawRichHtmlBlockToPdf(doc, child, locale, fontName, { ...helpers, width: width - 10 });
      }
      doc.x = x;
      continue;
    }

    if (block.type === "hr") {
      ensureSpace(doc, 16, fontName);
      const y = doc.y + 6;
      doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor("#cbd5e1").stroke();
      doc.y = y + 10;
      continue;
    }

    if (block.type === "bordered") {
      ensureSpace(doc, 40, fontName);
      doc.y += EXPORT_ELEMENT_MARGIN_V_PT;
      doc.x = MARGIN;
      const padH = EXPORT_BLOCK_PAD_H_PT;
      const padV = EXPORT_BLOCK_PAD_V_PT;
      const innerW = width - padH * 2;
      const startY = doc.y;
      doc.x = MARGIN + padH;
      for (const child of block.children || []) {
        drawRichHtmlBlockToPdf(doc, child, locale, fontName, { ...helpers, width: innerW });
      }
      const endY = doc.y;
      doc.save();
      doc
        .rect(MARGIN, startY - padV, width, endY - startY + padV * 2)
        .strokeColor("#94a3b8")
        .lineWidth(1)
        .stroke();
      doc.restore();
      doc.y = endY + padV + EXPORT_ELEMENT_MARGIN_V_PT;
      doc.x = MARGIN;
      continue;
    }

    if (block.type === "image") {
      ensureSpace(doc, 200, fontName);
      drawMediaImage(doc, block.fileId, block.src, files, locale, width, fontName);
      continue;
    }

    if (block.type === "video") {
      ensureSpace(doc, 24, fontName);
      const note =
        locale === "fr" ? "[Vidéo — non incluse dans le PDF]" : "[فيديو — غير مضمن في PDF]";
      doc
        .font(fontName)
        .fontSize(9)
        .fillColor("#64748b")
        .text(note, pdfTextOpts(locale, { width, align: pdfAlign("center", locale) }));
      doc.moveDown(0.5);
      doc.fillColor("#0f172a");
      continue;
    }

    if (block.type === "html_table") {
      drawPdfHtmlTable(doc, block, locale, fontName, helpers);
      continue;
    }

    if (block.type === "schema_table_ref" || block.type === "embedded_table") {
      const table =
        block.type === "embedded_table"
          ? block.table
          : findEmbeddedTable(embeddedTables, block.tableId);
      if (!table) continue;
      ensureSpace(doc, 80, fontName);
      const meta = table.table_meta || {};
      const title = locale === "fr" ? meta.title_fr || meta.title_ar : meta.title_ar || meta.title_fr;
      if (title) {
        doc
          .font(fontName)
          .fontSize(14)
          .fillColor("#0f172a")
          .text(title, pdfTextOpts(locale, { width, align: "center" }));
        doc.moveDown(0.3);
      }
      drawTable(doc, table.columns || [], table.layout_json, meta, table.rows || [], locale, fontName, {
        embedded: true,
      });
    }
  }
}

function drawRichHtmlBlockToPdf(doc, block, locale, fontName, helpers) {
  const { width, margin, boldFontName, MARGIN } = helpers;
  if (!block) return;
  if (block.type === "paragraph" || block.type === "heading") {
    const baseSize = block.type === "heading" ? headingBaseSize(block.level) : 11;
    if (block.type === "heading") {
      for (const r of block.runs) r.bold = true;
    }
    drawPdfRuns(doc, block.runs, {
      fontName,
      boldFontName: boldFontName || fontName,
      baseSize,
      align: block.align,
      locale,
      width,
      margin: margin ?? MARGIN
    });
  }
}

function drawPdfHtmlTable(doc, block, locale, fontName, helpers) {
  const { ensureSpace, MARGIN } = helpers;
  const rows = block.rows || [];
  if (!rows.length) return;

  const colCount = Math.max(...rows.map((r) => r.length));
  const pageW = doc.page.width - MARGIN * 2;
  const colW = pageW / colCount;
  const colWidths = Array(colCount).fill(colW);
  const slots = buildTableColumnSlots(colWidths, pageW, MARGIN, locale);
  const rowH = 18;
  const fontSize = 9;

  ensureSpace(doc, rowH + EXPORT_ELEMENT_MARGIN_V_PT * 2, fontName);
  doc.y += EXPORT_ELEMENT_MARGIN_V_PT;
  doc.x = MARGIN;
  let y = doc.y;

  function newPageIfNeeded(extra) {
    if (y + extra > doc.page.height - MARGIN) {
      doc.addPage({ size: "A4", layout: "portrait", margin: MARGIN });
      y = MARGIN;
    }
  }

  for (const row of rows) {
    newPageIfNeeded(rowH);
    row.forEach((cell, i) => {
      const slot = slots[i];
      if (!slot) return;
      const { x, w } = slot;
      doc.rect(x, y, w, rowH).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
      if (cell.header) {
        doc.save();
        doc.rect(x, y, w, rowH).fillColor("#f1f5f9").fill();
        doc.restore();
        doc.rect(x, y, w, rowH).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
      }
      const text = (cell.runs || []).map((r) => r.text).join("");
      doc
        .font(fontName)
        .fontSize(fontSize)
        .fillColor("#0f172a")
        .text(
          text,
          x + 3,
          y + 4,
          pdfTextOpts(locale, {
            width: w - 6,
            height: rowH - 6,
            align: pdfAlign(cell.align, locale),
            ellipsis: true,
          }),
        );
    });
    y += rowH;
  }

  doc.y = y + EXPORT_ELEMENT_MARGIN_V_PT;
  doc.x = MARGIN;
}

function docxAlign(align, locale) {
  const normalized = normalizeAlign(align, locale);
  if (normalized) return normalized;
  return locale === "ar" ? "right" : "left";
}

function docxAlignmentType(align, locale, AlignmentType) {
  const a = docxAlign(align, locale);
  if (a === "center") return AlignmentType.CENTER;
  if (a === "left") return AlignmentType.LEFT;
  return AlignmentType.RIGHT;
}

function docxRunColor(color) {
  if (!color) return "000000";
  return String(color).replace("#", "").toUpperCase();
}

function runStyleKey(r, baseSize) {
  return [
    !!r.bold,
    !!r.italic,
    !!r.underline,
    !!r.strike,
    docxRunColor(r.color),
    r.fontSize ? pxToDocxSize(r.fontSize) : baseSize
  ].join("|");
}

function runsToDocxTextRuns(runs, locale, TextRun, baseSize, fontFamily) {
  const rtl = locale === "ar";
  const filtered = (runs || []).filter((r) => r.text && !r.lineBreak);
  const merged = [];

  for (const r of filtered) {
    const last = merged[merged.length - 1];
    if (last && runStyleKey(last, baseSize) === runStyleKey(r, baseSize)) {
      last.text += r.text;
      continue;
    }
    merged.push({ ...r });
  }

  return merged.map(
    (r) =>
      new TextRun({
        text: r.text,
        font: fontFamily,
        bold: !!r.bold,
        italics: !!r.italic,
        underline: r.underline ? {} : undefined,
        strike: r.strike,
        color: docxRunColor(r.color),
        size: r.fontSize ? pxToDocxSize(r.fontSize) : baseSize,
        rightToLeft: rtl
      })
  );
}

function richHtmlToDocxChildren(html, locale, docx, helpers) {
  const {
    files,
    embeddedTables,
    para,
    appendTableExportBlocks,
    tableNeedsPortraitPage,
    portraitPageBreak,
    mediaParagraphs,
    absFilePath,
    absPathFromUploadsUrl,
    imageTypeFromFile,
    docxFontFamily,
    IMAGE_W,
    IMAGE_H,
    spacingPara,
    blockPadTwip
  } = helpers;
  const fontFamily = docxFontFamily?.(locale) || (locale === "ar" ? "Arial" : "Calibri");
  const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = docx;
  const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
  const blocks = appendUnusedEmbeddedTables(parseRichHtml(html, locale), embeddedTables);
  const out = [];

  function blockParagraphs(innerBlocks, indent = 0) {
    const items = [];
    for (const block of innerBlocks) {
      items.push(...blockToParagraphs(block, indent));
    }
    return items;
  }

  function blockToParagraphs(block, indent = 0) {
    if (!block) return [];

    if (block.type === "spacer") {
      return [new Paragraph({ children: [new TextRun({ text: "" })] })];
    }

    if (block.type === "paragraph") {
      return [
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: docxAlignmentType(block.align, locale, AlignmentType),
          indent: indent ? { left: indent } : undefined,
          children: runsToDocxTextRuns(block.runs, locale, TextRun, 22, fontFamily)
        })
      ];
    }

    if (block.type === "heading") {
      const runs = (block.runs || []).map((r) => ({ ...r, bold: true }));
      const headingSize = block.level === 1 ? 32 : block.level === 2 ? 28 : 24;
      return [
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: docxAlignmentType(block.align, locale, AlignmentType),
          children: runsToDocxTextRuns(runs, locale, TextRun, headingSize, fontFamily)
        })
      ];
    }

    if (block.type === "list") {
      const items = [];
      block.items.forEach((item, idx) => {
        const bullet = block.ordered ? `${idx + 1}. ` : "• ";
        const runs = [{ text: bullet, bold: true }, ...(item.runs || [])];
        items.push(
          new Paragraph({
            bidirectional: locale === "ar",
            alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: runsToDocxTextRuns(runs, locale, TextRun, 22, fontFamily)
          })
        );
        items.push(...blockParagraphs(item.nested || [], 360));
      });
      return items;
    }

    if (block.type === "blockquote") {
      return blockParagraphs(block.children || [], 360);
    }

    if (block.type === "bordered") {
      const inner = blockParagraphs(block.children || []);
      if (!inner.length) return [];
      const tableMargin = marginTwip();
      const pad = blockPadTwip?.() || {
        top: marginTwip(EXPORT_BLOCK_PAD_V_PT),
        bottom: marginTwip(EXPORT_BLOCK_PAD_V_PT),
        left: marginTwip(EXPORT_BLOCK_PAD_H_PT),
        right: marginTwip(EXPORT_BLOCK_PAD_H_PT)
      };
      const borderedTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                margins: pad,
                borders: {
                  top: TABLE_BORDER,
                  bottom: TABLE_BORDER,
                  left: TABLE_BORDER,
                  right: TABLE_BORDER
                },
                children: inner
              })
            ]
          })
        ]
      });
      if (!spacingPara) return [borderedTable];
      return [
        spacingPara(locale, { after: tableMargin }),
        borderedTable,
        spacingPara(locale, { before: tableMargin })
      ];
    }

    if (block.type === "hr") {
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1" } },
          children: [new TextRun({ text: "" })]
        })
      ];
    }

    if (block.type === "image") {
      const file = resolveMediaFile(block.fileId, block.src, files);
      let abs = file ? absFilePath(file) : null;
      if (!abs && absPathFromUploadsUrl) abs = absPathFromUploadsUrl(block.src);
      const isImage = !file || file.media_kind === "image" || /\.(jpe?g|png|gif|webp)$/i.test(abs || block.src || "");
      if (abs && isImage) {
        try {
          return [
            new Paragraph({
              bidirectional: locale === "ar",
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: require("fs").readFileSync(abs),
                  transformation: { width: IMAGE_W, height: IMAGE_H },
                  type: imageTypeFromFile(file, abs)
                })
              ]
            })
          ];
        } catch {
          return [para(file.original_name, locale)];
        }
      }
      return [];
    }

    if (block.type === "video") {
      const note =
        locale === "fr" ? "[Vidéo — non incluse dans le document]" : "[فيديو — غير مضمن في المستند]";
      return [para(note, locale, { italics: true })];
    }

    if (block.type === "html_table") {
      const parts = [];
      const tableMargin = marginTwip();
      const rows = (block.rows || []).map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  shading: cell.header ? { fill: "F1F5F9" } : undefined,
                  borders: {
                    top: TABLE_BORDER,
                    bottom: TABLE_BORDER,
                    left: TABLE_BORDER,
                    right: TABLE_BORDER
                  },
                  children: [
                    new Paragraph({
                      bidirectional: locale === "ar",
                      alignment: docxAlignmentType(cell.align, locale, AlignmentType),
                      children: runsToDocxTextRuns(cell.runs, locale, TextRun, 20, fontFamily)
                    })
                  ]
                })
            )
          })
      );
      if (rows.length) {
        if (spacingPara) parts.push(spacingPara(locale, { after: tableMargin }));
        parts.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
        if (spacingPara) parts.push(spacingPara(locale, { before: tableMargin }));
      }
      return parts;
    }

    if (block.type === "schema_table_ref" || block.type === "embedded_table") {
      const table =
        block.type === "embedded_table"
          ? block.table
          : findEmbeddedTable(embeddedTables, block.tableId);
      if (!table) return [];
      const parts = [];
      appendTableExportBlocks(
        parts,
        table.columns || [],
        table.layout_json,
        table.table_meta || {},
        table.rows || [],
        locale,
        { embedded: true },
      );
      return parts;
    }

    return [];
  }

  for (const block of blocks) {
    out.push(...blockToParagraphs(block));
  }

  return out.filter(Boolean);
}

module.exports = {
  parseRichHtml,
  appendUnusedEmbeddedTables,
  drawRichHtmlToPdf,
  richHtmlToDocxChildren,
  resolveMediaFile,
  pxToPt,
  pxToDocxSize
};
