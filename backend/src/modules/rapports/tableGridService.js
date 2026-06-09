const { Municipality, RapportTableSchema } = require("../../db");
const { extractTableMeta, normalizeMergedRows } = require("./tableLayoutService");
const { safeEvalFormula, excelColumnLetter, FORMULA_COL_TYPES } = require("./formulaEngine");

function recalcTableRows(rows, columns) {
  return rows.map((row) => {
    const next = { ...row };
    for (const col of columns) {
      if (col.type === "formula" && col.formula) {
        next[col.key] = safeEvalFormula(col.formula, next, columns);
      }
    }
    return next;
  });
}

function formatCellDisplay(value, format) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (format === "percent") return `${n.toFixed(1)} %`;
  if (format === "currency") return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  if (format === "integer") return String(Math.round(n));
  return String(n);
}

async function loadSchemaBySlug(slug) {
  const schema = await RapportTableSchema.findOne({ where: { slug } });
  if (!schema) {
    const err = new Error("Schema not found");
    err.status = 404;
    throw err;
  }
  return schema;
}

function buildSingleEmptyRow(columns) {
  const row = { _row_finished: false, _wali_visible: true, _cell_colors: {} };
  for (const col of columns || []) {
    if (col.type === "commune_ref") row[col.key] = "";
    else if (col.type === "number" || col.type === "formula") row[col.key] = null;
    else if (col.type === "choice") row[col.key] = col.choices?.[0]?.value || "";
    else row[col.key] = "";
  }
  return row;
}

async function buildDefaultTableRows(columns) {
  const hasCommuneRef = (columns || []).some((col) => col.type === "commune_ref");
  if (!hasCommuneRef) {
    return [buildSingleEmptyRow(columns)];
  }

  const munis = await Municipality.findAll({ order: [["code", "ASC"]] });
  return munis.map((m) => {
    const row = {
      municipality_code: m.code,
      _municipality_name_ar: m.name_ar,
      _municipality_name_fr: m.name_fr,
      _row_finished: false,
      _wali_visible: true,
      _cell_colors: {}
    };
    for (const col of columns) {
      if (col.type === "commune_ref") row[col.key] = m.code;
      else if (col.type === "number" || col.type === "formula") row[col.key] = null;
      else if (col.type === "choice") row[col.key] = col.choices?.[0]?.value || "";
      else if (col.type === "text") row[col.key] = "";
    }
    return row;
  });
}

/** Legacy: simple schemas were seeded with one row per commune (53). Collapse to one row when no commune column. */
function trimSpuriousMunicipalityRows(rows, columns) {
  if (!rows?.length || rows.length <= 1) return rows;
  const hasCommuneRef = (columns || []).some((col) => col.type === "commune_ref");
  if (hasCommuneRef) return rows;
  const seeded = rows.every(
    (r) => r.municipality_code != null && (r._municipality_name_ar != null || r._municipality_name_fr != null)
  );
  if (!seeded) return rows;
  const kept = { ...rows[0] };
  delete kept.municipality_code;
  delete kept._municipality_name_ar;
  delete kept._municipality_name_fr;
  return [kept];
}

function defaultCellForColumn(col, row = {}) {
  if (col.type === "commune_ref") return row.municipality_code ?? row[col.key] ?? "";
  if (col.type === "number" || col.type === "formula") return null;
  if (col.type === "choice") return col.choices?.[0]?.value || "";
  if (col.type === "date") return "";
  return "";
}

function mergeRowsWithSchema(rows, columns) {
  return (rows || []).map((row) => {
    const next = { ...row };
    for (const col of columns || []) {
      if (col.key == null) continue;
      if (!(col.key in next)) next[col.key] = defaultCellForColumn(col, row);
    }
    return next;
  });
}

function normalizeTablePayload(dataJson, columns, layoutJson) {
  const tables = dataJson?.tables || [];
  const main = tables[0] || { key: "main", rows: [] };
  let rows = main.rows || [];
  if (!rows.length) rows = [];
  rows = trimSpuriousMunicipalityRows(rows, columns);
  rows = mergeRowsWithSchema(rows, columns);
  const mergeKeys = main.merge_column_keys || [];
  rows = normalizeMergedRows(recalcTableRows(rows, columns), mergeKeys);
  const meta = extractTableMeta(main, layoutJson, columns);
  return {
    tables: [
      {
        key: main.key || "main",
        ...meta,
        merge_column_keys: meta.merge_column_keys,
        rows,
        media_rows: main.media_rows || []
      }
    ]
  };
}

module.exports = {
  safeEvalFormula,
  excelColumnLetter,
  recalcTableRows,
  formatCellDisplay,
  loadSchemaBySlug,
  buildDefaultTableRows,
  buildSingleEmptyRow,
  mergeRowsWithSchema,
  normalizeTablePayload,
  trimSpuriousMunicipalityRows
};
