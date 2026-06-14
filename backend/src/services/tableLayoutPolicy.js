/** Shared rules for schema tables: view scroll, PDF/DOCX page breaks and orientation. */

const TABLE_PORTRAIT_ROW_THRESHOLD = 3;
const VIEW_WIDE_COL_THRESHOLD = 6;

/** Minimum readable column width (pt) when estimating layout. */
const MIN_COL_PT = 48;
/** A4 portrait printable width (595pt page − margins). */
const PORTRAIT_INNER_PT = 515;
const TABLE_ROW_H_PT = 16;

const COL_WEIGHT = {
  text: 2.2,
  number: 1.2,
  commune_ref: 1.8,
  default: 1.5,
};

const COL_MIN_PX = {
  text: 132,
  number: 76,
  commune_ref: 108,
  meta: 44,
  default: 96,
};

function tableNeedsPortraitPage(rows) {
  return (rows || []).length > TABLE_PORTRAIT_ROW_THRESHOLD;
}

function countMetaColumns(opts = {}) {
  let n = 0;
  if (opts.includeCommuneNames) n += 1;
  if (opts.includeLineNumbers !== false) n += 1;
  if (opts.includeAdminMeta) n += 2;
  return n;
}

function columnWeight(col) {
  const t = col?.type || "text";
  return COL_WEIGHT[t] || COL_WEIGHT.default;
}

function columnMinPx(col, kind = "data") {
  if (kind === "meta") return COL_MIN_PX.meta;
  const t = col?.type || "text";
  return COL_MIN_PX[t] || COL_MIN_PX.default;
}

function pdfCellAlign(locale, { center = false } = {}) {
  if (center) return "center";
  return locale === "ar" ? "right" : "left";
}

/** Column x/w positions — right-to-left column order for Arabic. */
function buildTableColumnSlots(colWidths, pageInnerWidth, margin, locale) {
  if (locale !== "ar") {
    let x = margin;
    return colWidths.map((w) => {
      const slot = { x, w };
      x += w;
      return slot;
    });
  }
  let x = margin + pageInnerWidth;
  return colWidths.map((w) => {
    x -= w;
    return { x, w };
  });
}

function tableColumnSpanRect(slots, startIdx, colSpan) {
  const slice = slots.slice(startIdx, startIdx + colSpan);
  if (!slice.length) return { x: 0, w: 0 };
  return {
    x: Math.min(...slice.map((s) => s.x)),
    w: slice.reduce((sum, s) => sum + s.w, 0),
  };
}

function exportFontSize(totalCols) {
  if (totalCols > 12) return 7;
  if (totalCols > 9) return 8;
  return 9;
}

function estimateTableHeightPt(rowCount, hasGroupRow = false, rowH = TABLE_ROW_H_PT) {
  const headerRows = hasGroupRow ? 2 : 1;
  return (headerRows + Math.max(rowCount, 0)) * rowH + 28;
}

function isLandscapePdfPage(doc) {
  return doc.page.width > doc.page.height;
}

/**
 * Place table on current page when it fits in portrait.
 * New page only when: (a) landscape width is required, or (b) not enough vertical space left.
 */
function ensurePdfTablePage(doc, policy, estimatedHeightPt, margin) {
  const spaceLeft = doc.page.height - margin - doc.y;
  const onLandscape = isLandscapePdfPage(doc);
  const fitsVertically = spaceLeft >= estimatedHeightPt + 8;
  const portraitPage = { size: "A4", layout: "portrait", margin };
  const landscapePage = { size: "A4", layout: "landscape", margin };

  if (!policy.useLandscape) {
    if (!onLandscape && fitsVertically) {
      doc.x = margin;
      return;
    }
    if (!onLandscape && !fitsVertically) {
      doc.addPage(portraitPage);
      doc.x = margin;
      return;
    }
    if (onLandscape) {
      doc.addPage(portraitPage);
      doc.x = margin;
    }
    return;
  }

  if (onLandscape && fitsVertically) {
    doc.x = margin;
    return;
  }

  doc.addPage(landscapePage);
  doc.x = margin;
}

function computeTableLayoutPolicy(input = {}) {
  const rows = input.rows || [];
  const rowCount = rows.length;
  const dataCols = input.columns || [];
  const dataColCount = input.dataColCount ?? dataCols.length;
  const metaColCount =
    input.metaColCount != null
      ? input.metaColCount
      : countMetaColumns({
          includeCommuneNames: input.includeCommuneNames,
          includeLineNumbers: input.includeLineNumbers,
          includeAdminMeta: input.includeAdminMeta,
        });
  const totalCols = Math.max(1, metaColCount + dataColCount);

  const useLandscape = totalCols * MIN_COL_PT > PORTRAIT_INNER_PT;
  const orientation = useLandscape ? "landscape" : "portrait";
  const viewNeedsHorizontalScroll = totalCols > VIEW_WIDE_COL_THRESHOLD;

  let estimatedMinWidthPx = metaColCount * COL_MIN_PX.meta;
  for (const col of dataCols) {
    estimatedMinWidthPx += columnMinPx(col, "data");
  }
  if (!dataCols.length && dataColCount > 0) {
    estimatedMinWidthPx += dataColCount * COL_MIN_PX.default;
  }

  const weights = [];
  for (let i = 0; i < metaColCount; i += 1) weights.push(0.7);
  for (const col of dataCols) weights.push(columnWeight(col));
  while (weights.length < totalCols) weights.push(1);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  return {
    totalCols,
    dataColCount,
    metaColCount,
    rowCount,
    orientation,
    useLandscape,
    viewNeedsHorizontalScroll,
    estimatedMinWidthPx,
    fontSize: exportFontSize(totalCols),
    columnWeightRatios: weights.map((w) => w / weightSum),
    pdfCellAlign: (opts) => pdfCellAlign(input.locale, opts),
  };
}

function pdfColumnWidths(pageInnerWidth, policy) {
  const ratios = [...policy.columnWeightRatios];
  while (ratios.length < policy.totalCols) ratios.push(1 / policy.totalCols);
  const sum = ratios.reduce((a, b) => a + b, 0) || 1;
  return ratios.map((r) => (pageInnerWidth * r) / sum);
}

/** Word column widths in twips (DXA). */
function docxColumnWidthsTwip(policy, tableWidthTwip) {
  const ratios = [...policy.columnWeightRatios];
  while (ratios.length < policy.totalCols) ratios.push(1 / policy.totalCols);
  const sum = ratios.reduce((a, b) => a + b, 0) || 1;
  return ratios.map((r) => Math.max(720, Math.round((tableWidthTwip * r) / sum)));
}

module.exports = {
  TABLE_PORTRAIT_ROW_THRESHOLD,
  VIEW_WIDE_COL_THRESHOLD,
  MIN_COL_PT,
  PORTRAIT_INNER_PT,
  TABLE_ROW_H_PT,
  tableNeedsPortraitPage,
  computeTableLayoutPolicy,
  estimateTableHeightPt,
  ensurePdfTablePage,
  pdfColumnWidths,
  docxColumnWidthsTwip,
  pdfCellAlign,
  buildTableColumnSlots,
  tableColumnSpanRect,
  countMetaColumns,
};
