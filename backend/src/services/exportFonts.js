const fs = require("fs");
const path = require("path");

function fontsDir() {
  return path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
}

function findFontFile(names) {
  const dir = fontsDir();
  for (const name of names) {
    const fp = path.join(dir, name);
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

/** PDFKit text options. Arabic uses logical-order text + right align + ligatures (not rtla). */
function pdfTextOpts(locale, opts = {}) {
  if (locale !== "ar") return opts;
  const align = opts.align || "right";
  return {
    ...opts,
    align,
    features: ["liga", "calt"],
  };
}

/** Register Arabic/French body fonts for PDFKit (Tahoma preferred for Arabic shaping). */
function registerPdfFonts(doc, locale) {
  const isAr = locale === "ar";
  const regularPath = findFontFile(
    isAr
      ? ["tahoma.ttf", "arial.ttf", "trado.ttf", "arabtype.ttf", "calibri.ttf"]
      : ["calibri.ttf", "arial.ttf", "times.ttf", "tahoma.ttf"]
  );
  const boldPath = findFontFile(
    isAr ? ["tahomabd.ttf", "arialbd.ttf", "tradbdo.ttf"] : ["calibrib.ttf", "arialbd.ttf", "timesbd.ttf"]
  );

  if (regularPath) {
    try {
      doc.registerFont("body", regularPath);
      if (boldPath) {
        try {
          doc.registerFont("bodyBold", boldPath);
        } catch {
          /* single face only */
        }
      }
      return { regular: "body", bold: boldPath ? "bodyBold" : "body" };
    } catch {
      /* fall through */
    }
  }

  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function docxFontFamily(locale) {
  return locale === "ar" ? "Tahoma" : "Calibri";
}

module.exports = {
  registerPdfFonts,
  docxFontFamily,
  pdfTextOpts
};
