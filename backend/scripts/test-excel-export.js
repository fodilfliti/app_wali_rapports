/**
 * Quick smoke test for locale Excel export (no DB required).
 * Run: node scripts/test-excel-export.js
 */
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { filterExportRows } = require("../src/services/excelExportRows");
const { writeTableToWorksheet } = require("../src/services/excelTableWriter");

async function writeSample(locale) {
  const rows = [
    { A: "نشط", B: 10, _wali_visible: true, _row_finished: false },
    { A: "مخفي", B: 20, _wali_visible: false, _row_finished: false },
    { A: "منتهي", B: 30, _wali_visible: true, _row_finished: true },
  ];
  const filtered = filterExportRows(rows, { rowFilter: "active", showHidden: false });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(locale === "fr" ? "Test FR" : "Test AR");
  writeTableToWorksheet(ws, 1, {
    locale,
    titleMeta: {
      title_ar: "تقرير تجريبي",
      title_fr: "Rapport test",
      subtitle_ar: "عنوان فرعي",
      subtitle_fr: "Sous-titre",
    },
    columns: [
      { key: "A", label_ar: "الوصف", label_fr: "Description", type: "text" },
      { key: "B", label_ar: "العدد", label_fr: "Nombre", type: "number" },
    ],
    layoutJson: {},
    rows: filtered,
    includeLineNumbers: true,
    includeAdminMeta: false,
  });

  const out = path.join(__dirname, "..", `tmp-test-export-${locale}.xlsx`);
  await workbook.xlsx.writeFile(out);
  console.log("Wrote", out);
}

async function main() {
  await writeSample("ar");
  await writeSample("fr");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
