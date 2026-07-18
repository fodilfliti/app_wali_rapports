"use strict";

/**
 * Shared helpers for prod cabinet bootstrap / ensure scripts.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const bcrypt = require("bcryptjs");
const ExcelJS = require("exceljs");

const { AccessRoleTemplate, User } = require("../../src/db");

const OUT_DIR = path.join(__dirname, "..", "..", "storage", "bootstrap");

const DEPT_NAME_AR = "ديوان الولاية";
const DEPT_NAME_FR = "Cabinet de la wilaya";

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function createUser({ username, name, role, job_title, templateSlug, password }) {
  const template = await AccessRoleTemplate.findOne({ where: { slug: templateSlug } });
  if (!template) {
    throw new Error(`Missing role template: ${templateSlug} — run migrations / seed-dev first`);
  }
  const hash = bcrypt.hashSync(password, 10);
  return User.create({
    username,
    name,
    job_title: job_title || null,
    email: `${username.replace(/\./g, "_")}@cabinet.local`,
    password_hash: hash,
    role,
    access_role_template_id: template.id,
    is_blocked: false,
    use_custom_permissions: false,
    email_hidden: true,
  });
}

async function writeCredentialsSheet(filePath, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("credentials");
  sheet.columns = [
    { header: "username", key: "username", width: 28 },
    { header: "name", key: "name", width: 32 },
    { header: "password", key: "password", width: 18 },
    { header: "job_title", key: "job_title", width: 50 },
    { header: "role", key: "role", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);
}

function bootstrapOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  return OUT_DIR;
}

function credentialRow({ username, name, password, job_title, role }) {
  return { username, name, password, job_title: job_title || "", role };
}

module.exports = {
  OUT_DIR,
  DEPT_NAME_AR,
  DEPT_NAME_FR,
  generatePassword,
  createUser,
  writeCredentialsSheet,
  bootstrapOutDir,
  credentialRow,
};
