const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { storageRoot } = require("./storage");
const { registerPdfFonts, pdfTextOpts, containsArabic } = require("./exportFonts");

function roleLabelFr(role) {
  if (role === "ADMIN") return "Administrateur";
  if (role === "WALI") return "Wali";
  if (role === "CHEF_CABINET") return "Chef de cabinet";
  if (role === "OFFICE_USER") return "Attaché de cabinet";
  return "Bureau";
}

function writePdfToFile(buildDoc, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
    doc.pipe(stream);
    buildDoc(doc);
    doc.end();
  });
}

/** French label + value; Arabic values use the same shaping opts as rapport PDF export. */
function drawLabeledValue(doc, font, label, value) {
  const text = value || "—";
  if (containsArabic(text)) {
    doc.font(font).fontSize(12).fillColor("#000000").text(`${label}:`, { align: "left" });
    doc.font(font).fontSize(14).text(text, pdfTextOpts("ar", { align: "right" }));
  } else {
    doc.font(font).fontSize(12).fillColor("#000000").text(`${label}: ${text}`, { align: "left" });
  }
  doc.moveDown(0.4);
}

/**
 * Draw one credentials page (caller owns page breaks).
 * Font = same registerPdfFonts() path as rapport PDF (Tahoma/Arial / DejaVu: AR + FR).
 */
function drawCredentialsPage(doc, font, { username, name, role, jobTitle, passwordLabel, passwordValue, confidentialLine }) {
  const roleFr = roleLabelFr(role);

  doc.font(font);
  doc.fillColor("#000000");

  doc.fontSize(18).text("Wilaya Rapports — Identifiants", { align: "left" });
  doc.moveDown(1.2);

  drawLabeledValue(doc, font, "Nom", name);
  if (jobTitle) {
    drawLabeledValue(doc, font, "Fonction", jobTitle);
  }
  doc.font(font).fontSize(12).text(`Identifiant: ${username}`, { align: "left" });
  doc.moveDown(0.4);
  doc.fontSize(12).text(`Type de compte: ${roleFr}`, { align: "left" });
  doc.moveDown(1);

  doc.fontSize(16).fillColor("#0d4f4f").text(`${passwordLabel}: ${passwordValue}`, { align: "left" });
  doc.fillColor("#000000");
  doc.moveDown(2);

  doc.fontSize(10).fillColor("#5a7070");
  doc.text(
    confidentialLine || "Confidentiel — traitez ce code comme un mot de passe.",
    { align: "left" },
  );
  doc.text("L'utilisateur doit le changer après la première connexion si la politique l'exige.", {
    align: "left",
  });
  doc.fillColor("#000000");
}

async function generateCredentialsPdf({ username, name, role, jobTitle, code8 }) {
  const safeUser = String(username || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const fileName = `credentials_${safeUser}_${Date.now()}.pdf`;
  const abs = path.join(storageRoot(), "pdf", fileName);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  await writePdfToFile((doc) => {
    // Same as rapport export: Arabic-capable face that still renders French/Latin.
    const pdfFonts = registerPdfFonts(doc, "ar");
    drawCredentialsPage(doc, pdfFonts.regular, {
      username,
      name,
      role,
      jobTitle,
      passwordLabel: "Code à 8 chiffres",
      passwordValue: code8,
    });
  }, abs);

  return {
    file_abs_path: abs,
    file_url: `/files/pdf/${fileName}`,
  };
}

/**
 * One PDF file: exactly one A4 page per user (N users ⇒ N pages).
 * Rows: { username, name, password, role, job_title? }
 */
async function writeCredentialsHandoutPdf(filePath, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    throw new Error("writeCredentialsHandoutPdf: no credential rows");
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  await writePdfToFile((doc) => {
    const pdfFonts = registerPdfFonts(doc, "ar");
    list.forEach((row, index) => {
      if (index > 0) doc.addPage();
      drawCredentialsPage(doc, pdfFonts.regular, {
        username: row.username,
        name: row.name,
        role: row.role,
        jobTitle: row.job_title || row.jobTitle || "",
        passwordLabel: "Mot de passe",
        passwordValue: row.password,
        confidentialLine: "Confidentiel — traitez ce mot de passe avec soin.",
      });
    });
  }, filePath);

  return filePath;
}

module.exports = { generateCredentialsPdf, writeCredentialsHandoutPdf, roleLabelFr };
