/** @typedef {'active' | 'with_finished' | 'finished_only'} ExcelRowFilter */

/**
 * Filter table rows for Excel export.
 * - active: Wali-visible (unless showHidden) and not finished
 * - with_finished: Wali-visible and any finish state
 * - finished_only: Wali-visible and finished only
 */
function filterExportRows(rows, { showHidden = false, rowFilter = "active" } = {}) {
  let list = rows || [];
  if (!showHidden) {
    list = list.filter((r) => r._wali_visible !== false);
  }
  if (rowFilter === "finished_only") {
    return list.filter((r) => r._row_finished === true);
  }
  if (rowFilter === "with_finished") {
    return list;
  }
  return list.filter((r) => r._row_finished !== true);
}

function parseExcelRowFilter(value) {
  if (value === "with_finished" || value === "finished_only") return value;
  return "active";
}

module.exports = {
  filterExportRows,
  parseExcelRowFilter,
};
