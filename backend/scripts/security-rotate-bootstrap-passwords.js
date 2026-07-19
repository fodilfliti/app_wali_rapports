"use strict";

/**
 * Quarantine leaked bootstrap credential sheets off the web file root,
 * then rotate passwords for those usernames and write a fresh Excel under private/bootstrap.
 *
 * Usage (from backend/): node scripts/security-rotate-bootstrap-passwords.js
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");
require("dotenv").config();

const { sequelize, User } = require("../src/db");
const { storageRoot } = require("../src/services/storage");
const {
  bootstrapOutDir,
  generatePassword,
  writeCredentialsSheet,
} = require("./lib/prodCabinetUsers");

async function readUsernamesFromXlsx(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const names = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const username = String(row.getCell(1).value || "").trim();
    if (username) names.push(username);
  });
  return names;
}

async function main() {
  const publicBootstrap = path.join(storageRoot(), "bootstrap");
  const privateDir = bootstrapOutDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Move any public bootstrap sheets into private/
  if (fs.existsSync(publicBootstrap)) {
    for (const name of fs.readdirSync(publicBootstrap)) {
      if (!name.endsWith(".xlsx")) continue;
      const from = path.join(publicBootstrap, name);
      const to = path.join(privateDir, `quarantined-${stamp}-${name}`);
      fs.renameSync(from, to);
      console.log("Moved", from, "->", to);
    }
  }

  const candidateFiles = fs
    .readdirSync(privateDir)
    .filter((n) => n.endsWith(".xlsx"))
    .map((n) => path.join(privateDir, n));

  const usernames = new Set();
  for (const f of candidateFiles) {
    for (const u of await readUsernamesFromXlsx(f)) usernames.add(u);
  }

  if (!usernames.size) {
    console.log("No usernames found in private/bootstrap sheets. Nothing to rotate.");
    await sequelize.close();
    return;
  }

  const rows = [];
  for (const username of usernames) {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      console.warn("Skip missing user:", username);
      continue;
    }
    if (user.role === "ADMIN") {
      console.warn("Skip ADMIN:", username);
      continue;
    }
    const password = generatePassword();
    await user.update({ password_hash: bcrypt.hashSync(password, 10) });
    rows.push({
      username: user.username,
      name: user.name,
      password,
      job_title: user.job_title || "",
      role: user.role,
    });
    console.log("Rotated password for", username);
  }

  if (rows.length) {
    const out = path.join(privateDir, `credentials-rotated-${stamp}.xlsx`);
    await writeCredentialsSheet(out, rows);
    console.log("Wrote", out);
    console.log("Distribute this file securely; do NOT put it under storage/.");
  }

  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
