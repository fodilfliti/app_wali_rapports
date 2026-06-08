const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { storageRoot } = require("./storage");

function resolveFontPath() {
  const winDir = process.env.WINDIR || "C:\\Windows";
  const fontsDir = path.join(winDir, "Fonts");
  for (const name of ["arial.ttf", "tahoma.ttf", "times.ttf", "calibri.ttf"]) {
    const p = path.join(fontsDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function registerBodyFont(doc) {
  const fp = resolveFontPath();
  if (fp) {
    try {
      doc.registerFont("body", fp);
      return "body";
    } catch {
      /* fall through */
    }
  }
  return "Helvetica";
}

function roleLabels(role) {
  if (role === "ADMIN") return { ar: "مدير", fr: "Administrateur" };
  if (role === "WALI") return { ar: "والي", fr: "Wali" };
  return { ar: "مكتب", fr: "Bureau" };
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

async function generateCredentialsPdf({ username, name, role, jobTitle, code8 }) {
  const safeUser = String(username || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const fileName = `credentials_${safeUser}_${Date.now()}.pdf`;
  const abs = path.join(storageRoot(), "pdf", fileName);
  const labels = roleLabels(role);

  await writePdfToFile((doc) => {
    const font = registerBodyFont(doc);
    doc.font(font);

    doc.fontSize(18).text("Wilaya Rapports — User Credentials", { align: "left" });
    doc.moveDown(0.35);
    doc.fontSize(13).text("تقارير الولاية — بيانات الدخول", { align: "right" });
    doc.moveDown(1.2);

    doc.fontSize(12).text(`Name / Nom: ${name || "—"}`, { align: "left" });
    doc.moveDown(0.4);
    if (jobTitle) {
      doc.fontSize(12).text(`Job title / Fonction: ${jobTitle}`, { align: "left" });
      doc.moveDown(0.4);
    }
    doc.fontSize(12).text(`Username / Identifiant: ${username}`, { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(12).text(`Role / Type: ${labels.fr} — ${labels.ar}`, { align: "left" });
    doc.moveDown(1);

    doc.fontSize(16).fillColor("#0d4f4f").text(`8-digit code / الرمز (8 أرقام): ${code8}`, { align: "left" });
    doc.fillColor("#000000");
    doc.moveDown(2);

    doc.fontSize(10).fillColor("#5a7070");
    doc.text(
      "Confidential — treat this code as a password. / سري — يُعامل هذا الرمز ككلمة مرور.",
      { align: "left" }
    );
    doc.text("The user should change it after first login if required by policy.", { align: "left" });
  }, abs);

  return {
    file_abs_path: abs,
    file_url: `/files/pdf/${fileName}`
  };
}

module.exports = { generateCredentialsPdf };
