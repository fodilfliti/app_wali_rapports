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
  BorderStyle
} = require("docx");
const { buildHeaderModel } = require("../modules/rapports/tableLayoutService");
const { formatCellDisplay } = require("../modules/rapports/tableGridService");
const { audit } = require("./audit");
const {
  pickText,
  blockText,
  absFilePath,
  imageTypeFromFile,
  loadExportData
} = require("./rapportExportData");

const IMAGE_W = 240;
const IMAGE_H = 180;
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };

function rtl(locale) {
  return locale === "ar";
}

function para(text, locale, opts = {}) {
  return new Paragraph({
    bidirectional: rtl(locale),
    alignment: opts.center ? AlignmentType.CENTER : rtl(locale) ? AlignmentType.RIGHT : AlignmentType.LEFT,
    heading: opts.heading,
    children: [new TextRun({ text: String(text || ""), rightToLeft: rtl(locale), bold: opts.bold, size: opts.size })]
  });
}

function mediaParagraphs(row, files, locale) {
  const items = (row.items || []).slice(0, 2);
  if (!items.length) return [];

  const runs = [];
  for (const it of items) {
    const file = files[it.file_id];
    if (!file) continue;

    if (file.media_kind === "video") {
      const note =
        locale === "fr" ? "[Vidéo — non incluse dans le document]" : "[فيديو — غير مضمن في المستند]";
      runs.push(new TextRun({ text: note, italics: true, rightToLeft: rtl(locale) }));
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
          runs.push(new TextRun({ text: file.original_name, rightToLeft: rtl(locale) }));
        }
      }
      continue;
    }

    runs.push(new TextRun({ text: file.original_name, rightToLeft: rtl(locale) }));
    runs.push(new TextRun({ text: "   ", rightToLeft: rtl(locale) }));
  }

  if (!runs.length) return [];
  return [
    new Paragraph({
      bidirectional: rtl(locale),
      alignment: AlignmentType.CENTER,
      children: runs
    })
  ];
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
          heading: HeadingLevel.HEADING_2,
          bold: true,
          center: block.align === "center"
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
        children: [new TextRun({ text: String(text ?? ""), rightToLeft: rtl(locale), size: 18 })]
      })
    ]
  });
}

function buildTableParagraphs(columns, layoutJson, tableMeta, rows, locale) {
  const header = buildHeaderModel(columns, layoutJson, locale);
  const cols = header.columnRow;
  if (!cols.length) return [];

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
              children: [new TextRun({ text: g.label || "", rightToLeft: rtl(locale), bold: true, size: 18 })]
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

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    })
  ];
}

function calendarParagraphs(events, locale) {
  if (!events?.length) return [];
  const out = [
    para(locale === "fr" ? "Dates calendrier" : "تواريخ التقويم", locale, { bold: true, size: 24 })
  ];
  for (const e of events) {
    const title = pickText(e, locale, "title_ar", "title_fr");
    const note = pickText(e, locale, "note_ar", "note_fr");
    const line = note ? `${e.event_date} — ${title} (${note})` : `${e.event_date} — ${title}`;
    out.push(para(line, locale, { size: 20 }));
  }
  return out;
}

async function buildDocxChildren(data, locale) {
  const { rapport, kind, viewPart, files, calendarEvents } = data;
  const serviceName = pickText(rapport.service, locale, "name_ar", "name_fr");
  const children = [
    para(rapport.title || "", locale, { bold: true, size: 32 }),
    para(serviceName, locale, { size: 20 }),
    rapport.reference_date ? para(String(rapport.reference_date), locale, { size: 20 }) : para("", locale)
  ];

  if (kind === "table_grid") {
    const tableMeta = viewPart.tableMeta || {};
    const title = pickText(tableMeta, locale, "title_ar", "title_fr");
    const subtitle = pickText(tableMeta, locale, "subtitle_ar", "subtitle_fr");
    if (title) children.push(para(title, locale, { bold: true, center: true }));
    if (subtitle) children.push(para(subtitle, locale, { center: true }));
    children.push(
      ...buildTableParagraphs(
        viewPart.schema?.columns || [],
        viewPart.schema?.layout_json,
        tableMeta,
        viewPart.rows,
        locale
      )
    );
    for (const row of viewPart.media_rows || []) {
      children.push(...mediaParagraphs(row, files, locale));
    }
  } else {
    children.push(...documentBlockParagraphs(viewPart.blocks, files, locale));
  }

  children.push(...calendarParagraphs(calendarEvents, locale));
  return children.filter(Boolean);
}

async function generateRapportDocx(rapportId, { locale = "ar", showHidden = false, actor, req } = {}) {
  const loc = locale === "fr" ? "fr" : "ar";
  const data = await loadExportData(rapportId, showHidden);
  const children = await buildDocxChildren(data, loc);
  const doc = new Document({
    sections: [{ properties: {}, children }]
  });
  const buffer = await Packer.toBuffer(doc);
  await audit(actor?.id, "RAPPORT_DOCX_EXPORT", { rapport_id: Number(rapportId), locale: loc }, { req });
  return { buffer, filename: `rapport-${rapportId}.docx` };
}

module.exports = { generateRapportDocx };
