const { trimOrEmpty } = require("../validation/bilingual");
const { formatCellDisplay } = require("../modules/rapports/tableGridService");
const {
  buildHeaderModel,
  computeRowSpanMap,
  cellMergeKey,
} = require("../modules/rapports/tableLayoutService");
const { cellBackgroundArgb } = require("./tableCellColors");
const { pickText } = require("./rapportExportData");

const THIN_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const META_LABELS = {
  wali: { ar: "الوالي", fr: "Wali" },
  num: { ar: "#", fr: "#" },
  finished: { ar: "منتهي", fr: "Terminé" },
  commune: { ar: "البلدية", fr: "Commune" },
};

const EXCEL_FONT = "Arial";
const DEFAULT_TITLE_COL_SPAN = 8;

function isRtlLocale(locale) {
  return locale !== "fr";
}

function metaLabel(key, locale) {
  const lang = locale === "fr" ? "fr" : "ar";
  return META_LABELS[key][lang];
}

function applyHeaderStyle(cell, { rtl = false } = {}) {
  cell.font = { name: EXCEL_FONT, bold: true, size: 11 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  cell.border = THIN_BORDER;
  cell.alignment = {
    horizontal: rtl ? "right" : "left",
    vertical: "middle",
    wrapText: true,
    readingOrder: rtl ? 2 : 1,
  };
}

function applyDataStyle(cell, { rtl = false, center = false } = {}) {
  cell.font = { name: EXCEL_FONT, size: 11 };
  cell.border = THIN_BORDER;
  cell.alignment = {
    horizontal: center ? "center" : rtl ? "right" : "left",
    vertical: "middle",
    wrapText: true,
    readingOrder: rtl ? 2 : 1,
  };
}

/** @deprecated Use pickText — kept for sheet name sanitization where both may appear. */
function bilingualCellText(ar, fr) {
  const a = trimOrEmpty(ar);
  const f = trimOrEmpty(fr);
  if (a && f && a !== f) return `${a}\n${f}`;
  return a || f || "";
}

function computeTableDimensions(columns, layoutJson, opts = {}) {
  const locale = opts.locale === "fr" ? "fr" : "ar";
  const header = buildHeaderModel(columns, layoutJson || {}, locale);
  const dataCols = header.columnRow;
  const hasGroups = header.hasGroupRow;
  const headerRows = (hasGroups ? 1 : 0) + 1;
  const includeCommuneNames = !!opts.includeCommuneNames;
  const includeLineNumbers = opts.includeLineNumbers !== false;
  const includeAdminMeta = !!opts.includeAdminMeta;
  const metaColCount =
    (includeCommuneNames ? 1 : 0) +
    (includeLineNumbers ? 1 : 0) +
    (includeAdminMeta ? 2 : 0);
  return {
    locale,
    rtl: isRtlLocale(locale),
    header,
    dataCols,
    hasGroups,
    headerRows,
    metaColCount,
    dataStartCol: metaColCount + 1,
    totalCols: Math.max(metaColCount + dataCols.length, 1),
  };
}

function setMergedBannerRow(worksheet, row, colCount, value, font, locale) {
  if (!value) return;
  const span = Math.max(colCount, 1);
  if (span > 1) {
    worksheet.mergeCells(row, 1, row, span);
  }
  const cell = worksheet.getCell(row, 1);
  cell.value = value;
  cell.font = font;
  const rtl = isRtlLocale(locale);
  cell.alignment = {
    wrapText: true,
    vertical: "middle",
    horizontal: rtl ? "right" : "left",
    readingOrder: rtl ? 2 : 1,
  };
  const lineCount = String(value).split(/\r?\n/).length;
  worksheet.getRow(row).height = Math.max(24, lineCount * 18 + 6);
}

function writeTitleBlock(
  worksheet,
  startRow,
  colCount,
  locale,
  { title_ar, title_fr, subtitle_ar, subtitle_fr, service_ar, service_fr },
) {
  let row = startRow;
  const title = pickText({ title_ar, title_fr }, locale, "title_ar", "title_fr");
  if (title) {
    setMergedBannerRow(worksheet, row, colCount, title, { name: EXCEL_FONT, bold: true, size: 16 }, locale);
    row += 1;
  }
  const service = pickText({ service_ar, service_fr }, locale, "service_ar", "service_fr");
  if (service) {
    setMergedBannerRow(
      worksheet,
      row,
      colCount,
      service,
      { name: EXCEL_FONT, italic: true, size: 12 },
      locale,
    );
    row += 1;
  }
  const subtitle = pickText({ subtitle_ar, subtitle_fr }, locale, "subtitle_ar", "subtitle_fr");
  if (subtitle) {
    setMergedBannerRow(worksheet, row, colCount, subtitle, { name: EXCEL_FONT, size: 11 }, locale);
    row += 1;
  }
  return row + 1;
}

function applyWorksheetReadingDirection(worksheet, locale) {
  if (isRtlLocale(locale)) {
    worksheet.views = [{ rightToLeft: true }];
  }
}

function writeMetaHeaderCells(
  worksheet,
  startRow,
  headerRows,
  startCol,
  locale,
  includeCommuneNames,
  includeLineNumbers,
  includeAdminMeta,
) {
  const rtl = isRtlLocale(locale);
  let col = startCol;
  if (includeCommuneNames) {
    worksheet.mergeCells(startRow, col, startRow + headerRows - 1, col);
    applyHeaderStyle(worksheet.getCell(startRow, col), { rtl });
    worksheet.getCell(startRow, col).value = metaLabel("commune", locale);
    col += 1;
  }
  if (includeAdminMeta) {
    worksheet.mergeCells(startRow, col, startRow + headerRows - 1, col);
    applyHeaderStyle(worksheet.getCell(startRow, col), { rtl });
    worksheet.getCell(startRow, col).value = metaLabel("wali", locale);
    col += 1;
  }
  if (includeLineNumbers) {
    worksheet.mergeCells(startRow, col, startRow + headerRows - 1, col);
    applyHeaderStyle(worksheet.getCell(startRow, col), { rtl });
    worksheet.getCell(startRow, col).value = metaLabel("num", locale);
    col += 1;
  }
  if (includeAdminMeta) {
    worksheet.mergeCells(startRow, col, startRow + headerRows - 1, col);
    applyHeaderStyle(worksheet.getCell(startRow, col), { rtl });
    worksheet.getCell(startRow, col).value = metaLabel("finished", locale);
    col += 1;
  }
  return col;
}

/**
 * Write one data table with locale-specific headers and optional merged title block.
 * Returns next free row index.
 */
function writeTableToWorksheet(
  worksheet,
  startRow,
  {
    columns,
    layoutJson,
    tableMeta = {},
    rows,
    locale = "ar",
    titleMeta = null,
    includeLineNumbers = true,
    includeAdminMeta = false,
    includeCommuneNames = false,
    mergeColumnKeys = [],
  },
) {
  const loc = locale === "fr" ? "fr" : "ar";
  const dims = computeTableDimensions(columns, layoutJson, {
    locale: loc,
    includeLineNumbers,
    includeAdminMeta,
    includeCommuneNames,
  });
  const { header, dataCols, hasGroups, headerRows, dataStartCol, totalCols, rtl } = dims;

  applyWorksheetReadingDirection(worksheet, loc);

  let tableStartRow = startRow;
  if (titleMeta) {
    tableStartRow = writeTitleBlock(worksheet, startRow, totalCols, loc, titleMeta);
  }

  writeMetaHeaderCells(
    worksheet,
    tableStartRow,
    headerRows,
    1,
    loc,
    includeCommuneNames,
    includeLineNumbers,
    includeAdminMeta,
  );

  if (hasGroups) {
    let colIdx = dataStartCol;
    header.groupRow.forEach((g) => {
      if (g.placeholder && !g.label) {
        colIdx += g.colSpan;
        return;
      }
      if (g.colSpan > 1) {
        worksheet.mergeCells(tableStartRow, colIdx, tableStartRow, colIdx + g.colSpan - 1);
      }
      applyHeaderStyle(worksheet.getCell(tableStartRow, colIdx), { rtl });
      worksheet.getCell(tableStartRow, colIdx).value = g.label || "";
      colIdx += g.colSpan;
    });
  }

  const colHeaderRow = tableStartRow + (hasGroups ? 1 : 0);
  dataCols.forEach((col, idx) => {
    applyHeaderStyle(worksheet.getCell(colHeaderRow, dataStartCol + idx), { rtl });
    worksheet.getCell(colHeaderRow, dataStartCol + idx).value = col.label || "";
  });

  const startDataRow = tableStartRow + headerRows;
  const spanMap = computeRowSpanMap(rows, mergeColumnKeys);
  rows.forEach((dataRow, rIdx) => {
    const row = worksheet.getRow(startDataRow + rIdx);
    let colIdx = 1;

    if (includeCommuneNames) {
      const communeCell = row.getCell(colIdx++);
      communeCell.value = pickText(
        dataRow,
        loc,
        "_municipality_name_ar",
        "_municipality_name_fr",
      );
      applyDataStyle(communeCell, { rtl });
    }

    if (includeAdminMeta) {
      const waliCell = row.getCell(colIdx++);
      waliCell.value = dataRow._wali_visible === false ? "" : "✓";
      applyDataStyle(waliCell, { center: true, rtl });
    }

    if (includeLineNumbers) {
      const numCell = row.getCell(colIdx++);
      numCell.value = rIdx + 1;
      applyDataStyle(numCell, { center: true, rtl });
    }

    if (includeAdminMeta) {
      const finCell = row.getCell(colIdx++);
      finCell.value = dataRow._row_finished ? "✓" : "";
      applyDataStyle(finCell, { center: true, rtl });
    }

    dataCols.forEach((col, dataIdx) => {
      const cell = row.getCell(dataStartCol + dataIdx);
      const schemaCol = columns.find((c) => c.key === col.key);
      const val = dataRow[col.key];

      if (mergeColumnKeys.includes(col.key)) {
        const spans = spanMap[col.key] || [];
        const span = spans[rIdx];
        if (span === 0) return;
        if (span > 1) {
          worksheet.mergeCells(
            startDataRow + rIdx,
            dataStartCol + dataIdx,
            startDataRow + rIdx + span - 1,
            dataStartCol + dataIdx,
          );
          cell.alignment = {
            vertical: "middle",
            wrapText: true,
            horizontal: rtl ? "right" : "left",
            readingOrder: rtl ? 2 : 1,
          };
        }
        cell.value = cellMergeKey(dataRow, col.key);
      } else {
        cell.value = formatCellDisplay(val, schemaCol?.format || col.format);
      }

      applyDataStyle(cell, { rtl });
      const bg = cellBackgroundArgb(dataRow, col.key);
      if (bg) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
      }
    });
  });

  const colCount = totalCols;
  const metaWidths = {};
  let metaCol = 1;
  if (includeCommuneNames) {
    metaWidths[metaCol] = 22;
    metaCol += 1;
  }
  if (includeAdminMeta) {
    metaWidths[metaCol] = 8;
    metaCol += 1;
  }
  if (includeLineNumbers) {
    metaWidths[metaCol] = 5;
    metaCol += 1;
  }
  if (includeAdminMeta) {
    metaWidths[metaCol] = 8;
    metaCol += 1;
  }
  for (let c = 1; c <= colCount; c += 1) {
    worksheet.getColumn(c).width = metaWidths[c] ?? 18;
  }

  void tableMeta;
  return startDataRow + rows.length + 1;
}

function writeTitleOnlyBlock(worksheet, locale, titleMeta, colSpan = DEFAULT_TITLE_COL_SPAN) {
  applyWorksheetReadingDirection(worksheet, locale);
  writeTitleBlock(worksheet, 1, colSpan, locale, titleMeta);
}

function sanitizeSheetName(name, used) {
  const base = String(name || "Table")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31) || "Table";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` ${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

module.exports = {
  writeTitleBlock,
  writeTitleOnlyBlock,
  writeTableToWorksheet,
  sanitizeSheetName,
  bilingualCellText,
  computeTableDimensions,
  applyWorksheetReadingDirection,
};
