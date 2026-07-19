const { pickBilingualText } = require("../../validation/bilingual");

function buildDefaultTableMeta(layoutJson = {}, columns = []) {
  const layout = layoutJson || {};
  const suggested = (columns || [])
    .filter((c) => c.merge_vertical_suggested)
    .map((c) => c.key);
  return {
    title_ar: layout.default_title_ar || "",
    title_fr: layout.default_title_fr || "",
    subtitle_ar: layout.default_subtitle_ar || "",
    subtitle_fr: layout.default_subtitle_fr || "",
    merge_column_keys: suggested
  };
}

function extractTableMeta(table = {}, layoutJson = {}, columns = []) {
  const defaults = buildDefaultTableMeta(layoutJson, columns);
  return {
    title_ar: table.title_ar ?? defaults.title_ar,
    title_fr: table.title_fr ?? defaults.title_fr,
    subtitle_ar: table.subtitle_ar ?? defaults.subtitle_ar,
    subtitle_fr: table.subtitle_fr ?? defaults.subtitle_fr,
    merge_column_keys: Array.isArray(table.merge_column_keys)
      ? table.merge_column_keys
      : defaults.merge_column_keys
  };
}

function buildHeaderModel(columns, layoutJson, locale = "ar") {
  const cols = columns || [];
  const groups = layoutJson?.header_groups || [];
  const groupedKeys = new Set();
  for (const g of groups) {
    for (const k of g.column_keys || []) groupedKeys.add(k);
  }

  const groupRow = [];
  const columnRow = [];

  for (const g of groups) {
    const keys = (g.column_keys || []).filter((k) => cols.some((c) => c.key === k));
    if (!keys.length) continue;
    groupRow.push({
      label: pickBilingualText(g.label_ar, g.label_fr, locale),
      colSpan: keys.length
    });
    for (const key of keys) {
      const col = cols.find((c) => c.key === key);
      if (col) {
        columnRow.push({
          key: col.key,
          label: pickBilingualText(col.label_ar, col.label_fr, locale)
        });
      }
    }
  }

  for (const col of cols) {
    if (groupedKeys.has(col.key)) continue;
    groupRow.push({ label: "", colSpan: 1, placeholder: true });
    columnRow.push({
      key: col.key,
      label: pickBilingualText(col.label_ar, col.label_fr, locale)
    });
  }

  const hasRealGroups = groupRow.some((g) => !g.placeholder && g.label);
  return {
    hasGroupRow: hasRealGroups,
    groupRow: hasRealGroups ? groupRow : [],
    columnRow
  };
}

function cellMergeKey(row, colKey) {
  if (colKey === "municipality_code" || colKey.endsWith("_code")) {
    return row[colKey] ?? row._municipality_name_ar ?? row._municipality_name_fr ?? "";
  }
  return row[colKey];
}

function computeRowSpanMap(rows, mergeColumnKeys = []) {
  const map = {};
  const keys = mergeColumnKeys || [];
  if (!keys.length || !rows?.length) return map;

  for (const colKey of keys) {
    map[colKey] = new Array(rows.length).fill(1);
    let i = 0;
    while (i < rows.length) {
      const val = cellMergeKey(rows[i], colKey);
      let j = i + 1;
      while (j < rows.length && cellMergeKey(rows[j], colKey) === val && val !== "" && val != null) {
        j += 1;
      }
      const span = j - i;
      map[colKey][i] = span;
      for (let k = i + 1; k < j; k += 1) map[colKey][k] = 0;
      i = j;
    }
  }
  return map;
}

/**
 * Merge columns are display/export-only (rowspan in UI / PDF / Excel).
 * Never blank repeated values in stored row data — callers must keep full cell values
 * so editing, reload, and rowspan computation keep working.
 */
function normalizeMergedRows(rows, _mergeColumnKeys = []) {
  return rows;
}

module.exports = {
  buildDefaultTableMeta,
  extractTableMeta,
  buildHeaderModel,
  computeRowSpanMap,
  normalizeMergedRows,
  cellMergeKey
};
