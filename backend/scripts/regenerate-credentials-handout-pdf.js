"use strict";

/**
 * Rebuild credentials-handout.pdf from existing Excel sheets (no DB wipe, no password change).
 *
 * Usage:
 *   npm run db:regenerate-credentials-handout
 *
 * Reads private/bootstrap/credentials-office.xlsx + credentials-chef-wali.xlsx
 * Writes private/bootstrap/credentials-handout.pdf (1 page per user).
 */

require("./load-env");

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const { bootstrapOutDir } = require("./lib/prodCabinetUsers");
const { writeCredentialsHandoutPdf } = require("../src/services/credentialsPdfService");

async function readCredentialRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const username = String(row.getCell(1).value || "").trim();
    if (!username) return;
    rows.push({
      username,
      name: String(row.getCell(2).value || "").trim(),
      password: String(row.getCell(3).value || "").trim(),
      job_title: String(row.getCell(4).value || "").trim(),
      role: String(row.getCell(5).value || "").trim(),
    });
  });
  return rows;
}

async function main() {
  const outDir = bootstrapOutDir();
  const officePath = path.join(outDir, "credentials-office.xlsx");
  const reviewPath = path.join(outDir, "credentials-chef-wali.xlsx");
  const handoutPath = path.join(outDir, "credentials-handout.pdf");

  const rows = [
    ...(await readCredentialRows(officePath)),
    ...(await readCredentialRows(reviewPath)),
  ];

  if (!rows.length) {
    console.error(
      "No rows found. Expected Excel files:\n" +
        `  ${officePath}\n` +
        `  ${reviewPath}\n` +
        "Run npm run db:seed-prod-bootstrap first, or place those sheets under private/bootstrap/.",
    );
    process.exit(1);
  }

  await writeCredentialsHandoutPdf(handoutPath, rows);
  console.log(`Wrote ${rows.length} page(s): ${handoutPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
