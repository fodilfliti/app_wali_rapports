const fs = require("fs");
const path = require("path");

/** Bundled fallback (Latin + Arabic) when OS fonts are missing — e.g. cPanel Linux. */
const BUNDLED_FONTS_DIR = path.join(__dirname, "..", "..", "assets", "fonts");

function windowsFontsDir() {
  return path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
}

function linuxFontDirs() {
  return [
    "/usr/share/fonts",
    "/usr/share/fonts/truetype",
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/usr/share/fonts/truetype/noto",
    "/usr/share/fonts/TTF",
    "/usr/local/share/fonts",
    path.join(process.env.HOME || "", ".fonts"),
  ];
}

function findFontFile(names) {
  const searchDirs = [BUNDLED_FONTS_DIR, windowsFontsDir(), ...linuxFontDirs()];
  for (const name of names) {
    for (const dir of searchDirs) {
      if (!dir) continue;
      const fp = path.join(dir, name);
      if (fs.existsSync(fp)) return fp;
    }
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

/**
 * Register Arabic/French body fonts for PDFKit (same path as rapport PDF export).
 * Prefers Tahoma/Arial (both AR + FR/EN), then bundled DejaVu Sans on Linux hosts.
 */
function registerPdfFonts(doc, locale) {
  const isAr = locale === "ar";
  const regularPath = findFontFile(
    isAr
      ? ["tahoma.ttf", "arial.ttf", "DejaVuSans.ttf", "trado.ttf", "arabtype.ttf", "calibri.ttf"]
      : ["calibri.ttf", "arial.ttf", "tahoma.ttf", "DejaVuSans.ttf", "times.ttf"],
  );
  const boldPath = findFontFile(
    isAr
      ? ["tahomabd.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf", "tradbdo.ttf"]
      : ["calibrib.ttf", "arialbd.ttf", "tahomabd.ttf", "DejaVuSans-Bold.ttf", "timesbd.ttf"],
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

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ""));
}

module.exports = {
  registerPdfFonts,
  docxFontFamily,
  pdfTextOpts,
  containsArabic,
};
