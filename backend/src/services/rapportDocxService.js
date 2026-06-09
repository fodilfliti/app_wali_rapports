const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
  BorderStyle,
  PageOrientation,
  PageBreak,
  convertInchesToTwip
} = require("docx");
const { buildHeaderModel } = require("../modules/rapports/tableLayoutService");
const { formatCellDisplay } = require("../modules/rapports/tableGridService");
const { audit } = require("./audit");
const {
  pickText,
  blockText,
  absFilePath,
  absPathFromUploadsUrl,
  imageTypeFromFile,
  loadExportData
} = require("./rapportExportData");
const { richHtmlToDocxChildren } = require("./richHtmlExport");
const { tableNeedsPortraitPage } = require("./rapportExportTable");
const { docxFontFamily } = require("./exportFonts");
const { marginTwip, blockPadTwip } = require("./exportLayout");
const { rapportExportFilename } = require("./rapportExportFilename");

const IMAGE_W = 240;
const IMAGE_H = 180;
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };

function rtl(locale) {
  return locale === "ar";
}

function paraAlign(locale, opts = {}) {
  if (opts.center || opts.align === "center") return AlignmentType.CENTER;
  if (opts.align === "left") return AlignmentType.LEFT;
  if (opts.align === "right") return AlignmentType.RIGHT;
  return rtl(locale) ? AlignmentType.RIGHT : AlignmentType.LEFT;
}

function para(text, locale, opts = {}) {
  return new Paragraph({
    bidirectional: rtl(locale),
    alignment: paraAlign(locale, opts),
    spacing: opts.spacing,
    children: [
      new TextRun({
        text: String(text || ""),
        font: docxFontFamily(locale),
        color: opts.color ? String(opts.color).replace("#", "").toUpperCase() : "000000",
        rightToLeft: rtl(locale),
        bold: opts.bold,
        italics: opts.italics,
        size: opts.size
      })
    ]
  });
}

function spacingPara(locale, { before = 0, after = 0 } = {}) {
  return para("", locale, { spacing: { before, after } });
}

function mediaParagraphs(row, files, locale) {
  const items = row.items || [];
  if (!items.length) return [];

  const paragraphs = [];
  for (let start = 0; start < items.length; start += 2) {
    const chunk = items.slice(start, start + 2);
    const runs = [];
    for (const it of chunk) {
      const file = files[it.file_id];
      if (!file) continue;

      if (file.media_kind === "video") {
        const note =
          locale === "fr" ? "[Vidéo — non incluse dans le document]" : "[فيديو — غير مضمن في المستند]";
        runs.push(new TextRun({ text: note, font: docxFontFamily(locale), italics: true, rightToLeft: rtl(locale) }));
        runs.push(new TextRun({ text: "   ", rightToLeft: rtl(locale) }));
        continue;
      }

      if (file.media_kind === "image") {
        const abs = absFilePath(file);
        if (abs) {
          try {
            runs.push(
              new ImageRun({
                data: fs.readFileSync(abs),
                transformation: { width: IMAGE_W, height: IMAGE_H },
                type: imageTypeFromFile(file, abs)
              })
            );
            runs.push(new TextRun({ text: "   ", rightToLeft: rtl(locale) }));
          } catch {
            runs.push(new TextRun({ text: file.original_name, font: docxFontFamily(locale), rightToLeft: rtl(locale) }));
          }
        }
        continue;
      }

      runs.push(new TextRun({ text: file.original_name, font: docxFontFamily(locale), rightToLeft: rtl(locale) }));
      runs.push(new TextRun({ text: "   ", rightToLeft: rtl(locale) }));
    }

    if (runs.length) {
      paragraphs.push(
        new Paragraph({
          bidirectional: rtl(locale),
          alignment: AlignmentType.CENTER,
          children: runs
        })
      );
    }
  }

  return paragraphs;
}

function documentBlockParagraphs(blocks, files, locale) {
  const out = [];
  for (const block of blocks || []) {
    if (block.type === "media_row") {
      out.push(...mediaParagraphs(block, files, locale));
      continue;
    }
    const txt = blockText(block, locale);
    if (!txt && block.type !== "heading") continue;
    if (block.type === "heading") {
      out.push(
        para(txt, locale, {
          bold: true,
          size: 28,
          center: block.align === "center",
          align: block.align
        })
      );
    } else {
      out.push(para(txt, locale));
    }
  }
  return out;
}

function tableCell(text, locale, shaded = false) {
  return new TableCell({
    shading: shaded ? { fill: "F1F5F9" } : undefined,
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER
    },
    children: [
      new Paragraph({
        bidirectional: rtl(locale),
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: String(text ?? ""),
            font: docxFontFamily(locale),
            rightToLeft: rtl(locale),
            size: 18
          })
        ]
      })
    ]
  });
}

function portraitPageBreak(locale) {
  return new Paragraph({
    bidirectional: rtl(locale),
    children: [new PageBreak()]
  });
}

function buildTableParagraphs(columns, layoutJson, tableMeta, rows, locale, opts = {}) {
  const header = buildHeaderModel(columns, layoutJson, locale);
  const cols = header.columnRow;
  if (!cols.length) return [];

  const blocks = [];
  if (opts.pageBreakBefore) blocks.push(portraitPageBreak(locale));

  const tableRows = [];

  if (header.hasGroupRow) {
    const cells = [];
    for (const g of header.groupRow) {
      if (!g.label && g.colSpan === 1) {
        cells.push(tableCell("", locale, true));
        continue;
      }
      cells.push(
        new TableCell({
          columnSpan: g.colSpan,
          shading: { fill: "E2E8F0" },
          borders: {
            top: TABLE_BORDER,
            bottom: TABLE_BORDER,
            left: TABLE_BORDER,
            right: TABLE_BORDER
          },
          children: [
            new Paragraph({
              bidirectional: rtl(locale),
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: g.label || "",
                  font: docxFontFamily(locale),
                  rightToLeft: rtl(locale),
                  bold: true,
                  size: 18
                })
              ]
            })
          ]
        })
      );
    }
    if (cells.length) tableRows.push(new TableRow({ children: cells }));
  }

  tableRows.push(
    new TableRow({
      children: cols.map((c) => tableCell(c.label, locale, true))
    })
  );

  for (const row of rows || []) {
    const cells = cols.map((c) => {
      const colDef = columns.find((col) => col.key === c.key);
      let val = row[c.key];
      if (colDef?.type === "commune_ref") {
        val = locale === "fr" ? row._municipality_name_fr : row._municipality_name_ar;
        val = val || row[c.key];
      } else if (colDef) {
        val = formatCellDisplay(val, colDef.format);
      }
      return tableCell(val, locale);
    });
    tableRows.push(new TableRow({ children: cells }));
  }

  const tableMargin = marginTwip();
  blocks.push(spacingPara(locale, { after: tableMargin }));
  blocks.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    })
  );
  blocks.push(spacingPara(locale, { before: tableMargin }));
  return blocks;
}

function appendTableExportBlocks(target, columns, layoutJson, tableMeta, rows, locale) {
  const title = pickText(tableMeta, locale, "title_ar", "title_fr");
  const subtitle = pickText(tableMeta, locale, "subtitle_ar", "subtitle_fr");
  const pageBreakBefore = tableNeedsPortraitPage(rows);
  if (pageBreakBefore) target.push(portraitPageBreak(locale));
  if (title) target.push(para(title, locale, { bold: true, center: true }));
  if (subtitle) target.push(para(subtitle, locale, { center: true }));
  target.push(
    ...buildTableParagraphs(columns, layoutJson, tableMeta, rows, locale, { pageBreakBefore: false })
  );
}

async function buildDocxChildren(data, locale) {
  const { kind, viewPart, files } = data;
  const children = [];

  if (kind === "table_grid") {
    const tableMeta = viewPart.tableMeta || {};
    appendTableExportBlocks(
      children,
      viewPart.schema?.columns || [],
      viewPart.schema?.layout_json,
      tableMeta,
      viewPart.rows,
      locale
    );
    for (const row of viewPart.media_rows || []) {
      children.push(...mediaParagraphs(row, files, locale));
    }
  } else {
    const dj = data.dataJson || {};
    const html = locale === "fr" ? dj.rich_html_fr : dj.rich_html_ar;
    if (html && String(html).trim()) {
      children.push(
        ...richHtmlToDocxChildren(html, locale, {
          Paragraph,
          TextRun,
          HeadingLevel,
          Table,
          TableRow,
          TableCell,
          WidthType,
          BorderStyle,
          AlignmentType,
          ImageRun
        }, {
          files,
          embeddedTables: dj.embedded_tables || [],
          para,
          buildTableParagraphs,
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
        })
      );
    } else {
      children.push(...documentBlockParagraphs(viewPart.blocks, files, locale));
      for (const table of dj.embedded_tables || []) {
        appendTableExportBlocks(
          children,
          table.columns || [],
          table.layout_json,
          table.table_meta || {},
          table.rows || [],
          locale
        );
      }
    }
  }

  return children.filter(Boolean);
}

async function generateRapportDocx(rapportId, { locale = "ar", showHidden = false, actor, req } = {}) {
  const loc = locale === "fr" ? "fr" : "ar";
  const data = await loadExportData(rapportId, showHidden);
  const children = await buildDocxChildren(data, loc);
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: docxFontFamily(loc),
            size: 22,
            rightToLeft: loc === "ar"
          },
          paragraph: {
            alignment: loc === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: convertInchesToTwip(8.27),
              height: convertInchesToTwip(11.69)
            },
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75)
            }
          }
        },
        children
      }
    ]
  });
  const buffer = await Packer.toBuffer(doc);
  await audit(actor?.id, "RAPPORT_DOCX_EXPORT", { rapport_id: Number(rapportId), locale: loc }, { req });
  return { buffer, filename: rapportExportFilename(data.rapport, "docx") };
}

module.exports = { generateRapportDocx };
