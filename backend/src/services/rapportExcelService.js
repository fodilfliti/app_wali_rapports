const ExcelJS = require("exceljs");
const { audit } = require("./audit");
const { loadExportData, pickText } = require("./rapportExportData");
const { rapportExportFilename } = require("./rapportExportFilename");
const { filterExportRows, parseExcelRowFilter } = require("./excelExportRows");
const {
  writeTitleOnlyBlock,
  writeTableToWorksheet,
  sanitizeSheetName,
} = require("./excelTableWriter");
const { canExportExcel } = require("../modules/access/assertCan");

function extractSchemaTableIds(html) {
  const ids = [];
  const re = /data-schema-table-id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html || ""))) ids.push(m[1]);
  return ids;
}

function embeddedTablesInRapport(dataJson) {
  const tables = dataJson.embedded_tables || [];
  const html = `${dataJson.rich_html_ar || ""}${dataJson.rich_html_fr || ""}`;
  if (!html.trim()) return tables;
  const used = new Set(extractSchemaTableIds(html));
  return tables.filter((t) => used.has(t.id));
}

function exportFilterOpts(options) {
  return {
    showHidden: options.showHidden === true,
    rowFilter: parseExcelRowFilter(options.rowFilter),
  };
}

function titleMetaFrom(rapport, tableMeta = {}) {
  return {
    title_ar: tableMeta.title_ar || rapport.title_ar,
    title_fr: tableMeta.title_fr || rapport.title_fr,
    subtitle_ar: tableMeta.subtitle_ar,
    subtitle_fr: tableMeta.subtitle_fr,
    service_ar: rapport.service?.name_ar,
    service_fr: rapport.service?.name_fr,
  };
}

function writeWorksheetTable(
  worksheet,
  {
    rapport,
    columns,
    layoutJson,
    tableMeta,
    rows,
    locale,
    includeLineNumbers,
    includeAdminMeta,
    includeCommuneNames,
    filterOpts,
  },
) {
  const exportRows = filterExportRows(rows, filterOpts);
  writeTableToWorksheet(worksheet, 1, {
    columns,
    layoutJson,
    tableMeta,
    rows: exportRows,
    locale,
    titleMeta: titleMetaFrom(rapport, tableMeta),
    includeLineNumbers,
    includeAdminMeta,
    includeCommuneNames,
    mergeColumnKeys: tableMeta?.merge_column_keys || [],
  });
}

async function generateRapportExcel(
  rapportId,
  { locale = "ar", showHidden = false, rowFilter = "active", versionId = null, actor, req } = {},
) {
  const loc = locale === "fr" ? "fr" : "ar";
  const filterOpts = exportFilterOpts({ showHidden, rowFilter });
  const { rapport, dataJson, viewPart } = await loadExportData(
    rapportId,
    filterOpts.showHidden,
    versionId,
  );

  const workbook = new ExcelJS.Workbook();
  const kind = rapport.rapportType?.content_kind;
  const communeContentKind = rapport.rapportType?.commune_content_kind;
  if (
    !canExportExcel({
      content_kind: kind,
      commune_content_kind: communeContentKind,
    })
  ) {
    const err = new Error("Export not supported for this rapport type");
    err.status = 400;
    throw err;
  }
  const usedSheetNames = new Set();

  if (kind === "table_grid") {
    const table = dataJson.tables?.[0];
    const sheetName = sanitizeSheetName(
      pickText(rapport, loc, "title_ar", "title_fr") || "Report",
      usedSheetNames,
    );
    const worksheet = workbook.addWorksheet(sheetName);
    if (!table) {
      writeTitleOnlyBlock(worksheet, loc, titleMetaFrom(rapport));
    } else {
      writeWorksheetTable(worksheet, {
        rapport,
        columns: viewPart.columns || viewPart.schema?.columns || [],
        layoutJson: viewPart.layoutJson || viewPart.schema?.layout_json || {},
        tableMeta: {
          title_ar: table.title_ar,
          title_fr: table.title_fr,
          subtitle_ar: table.subtitle_ar,
          subtitle_fr: table.subtitle_fr,
          merge_column_keys: table.merge_column_keys || [],
        },
        rows: table.rows || [],
        locale: loc,
        includeLineNumbers: true,
        includeAdminMeta: false,
        includeCommuneNames: false,
        filterOpts,
      });
    }
  } else if (kind === "commune_list") {
    const table = dataJson.tables?.[0];
    const sheetName = sanitizeSheetName(
      pickText(rapport, loc, "title_ar", "title_fr") || "Communes",
      usedSheetNames,
    );
    const worksheet = workbook.addWorksheet(sheetName);
    writeWorksheetTable(worksheet, {
      rapport,
      columns: viewPart.columns || [],
      layoutJson: viewPart.layoutJson || {},
      tableMeta: {
        title_ar: table?.title_ar || rapport.title_ar,
        title_fr: table?.title_fr || rapport.title_fr,
        merge_column_keys: [],
      },
      rows: table?.rows || [],
      locale: loc,
      includeLineNumbers: true,
      includeAdminMeta: false,
      includeCommuneNames: true,
      filterOpts,
    });
  } else {
    const err = new Error("Export not supported for this rapport type");
    err.status = 400;
    throw err;
  }

  const buffer = await workbook.xlsx.writeBuffer();

  audit(rapport.created_by_user_id, "RAPPORT_EXPORT", {
    rapport_id: rapportId,
    format: "xlsx",
    locale: loc,
    rowFilter: filterOpts.rowFilter,
    showHidden: filterOpts.showHidden,
  });

  return {
    buffer,
    filename: rapportExportFilename(rapport, "xlsx", loc),
  };
}

module.exports = {
  generateRapportExcel,
  filterExportRows,
  parseExcelRowFilter,
  embeddedTablesInRapport,
};
