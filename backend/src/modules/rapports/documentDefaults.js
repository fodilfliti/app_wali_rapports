const REPUBLIC_AR =
  "الجمهـــوريـــة الجـــزائريـــة الديمقـــراطيــــة الشعــبيــــة";
const REPUBLIC_FR = "République Algérienne Démocratique et Populaire";
const WILAYA_AR = "ولايــة تلمســان";
const WILAYA_FR = "Wilaya de Tlemcen";
const DIWAN_AR = "الديوان";
const DIWAN_FR = "Le Diwan";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Letterhead line: bold centered paragraph (normal body size — not a large heading). */
function letterheadLineBlock(textAr, textFr) {
  return {
    type: "paragraph",
    align: "center",
    bold: true,
    text_ar: textAr || "",
    text_fr: textFr || "",
  };
}

function headingBlock(textAr, textFr, align = "center", level = 2) {
  return {
    type: "heading",
    align,
    bold: true,
    level,
    text_ar: textAr || "",
    text_fr: textFr || "",
  };
}

function letterheadHtmlLine(text) {
  return `<p style="text-align: center"><strong>${escapeHtml(text)}</strong></p>`;
}

function titleHtml(text, { asH3 = false } = {}) {
  const t = String(text || "").trim();
  if (!t) return "";
  const tag = asH3 ? "h3" : "h2";
  return `<${tag} style="text-align: center">${escapeHtml(t)}</${tag}>`;
}

/** Standard wilaya letterhead blocks (republic, wilaya, diwan — editable after creation). */
function buildOfficialHeaderBlocks() {
  return [
    letterheadLineBlock(REPUBLIC_AR, REPUBLIC_FR),
    letterheadLineBlock(WILAYA_AR, WILAYA_FR),
    letterheadLineBlock(DIWAN_AR, DIWAN_FR),
  ];
}

function buildOfficialHeaderHtml(locale = "ar") {
  const lines =
    locale === "fr"
      ? [REPUBLIC_FR, WILAYA_FR, DIWAN_FR]
      : [REPUBLIC_AR, WILAYA_AR, DIWAN_AR];
  return lines.map(letterheadHtmlLine).join("");
}

/** TipTap / rich_html default for documents & fiches (letterhead + optional title). */
function buildDocumentDefaultDataJson({ titleAr, titleFr, titleAsH3 = false } = {}) {
  return {
    rich_html_ar:
      buildOfficialHeaderHtml("ar") + titleHtml(titleAr, { asH3: titleAsH3 }) + "<p></p>",
    rich_html_fr:
      buildOfficialHeaderHtml("fr") + titleHtml(titleFr, { asH3: titleAsH3 }) + "<p></p>",
    blocks: buildDocumentDefaultBlocks({ titleAr, titleFr, titleLevel: titleAsH3 ? 3 : 2 }),
    embedded_tables: [],
  };
}

/** Default blocks for document_compose / fiche_lecture when no template is set. */
function buildDocumentDefaultBlocks({ titleAr, titleFr, titleLevel = 2 } = {}) {
  const blocks = [...buildOfficialHeaderBlocks()];
  if (titleAr || titleFr) {
    blocks.push(headingBlock(titleAr || "", titleFr || "", "center", titleLevel));
  }
  blocks.push({ type: "paragraph", text_ar: "", text_fr: "" });
  return blocks;
}

function buildFicheDefaultBlocks() {
  return buildDocumentDefaultBlocks({
    titleAr: "مذكرة استخلاصية",
    titleFr: "Fiche lecture",
    titleLevel: 3,
  });
}

function buildFicheDefaultDataJson() {
  return buildDocumentDefaultDataJson({
    titleAr: "مذكرة استخلاصية",
    titleFr: "Fiche lecture",
    titleAsH3: true,
  });
}

/** Default blocks for a commune complex document (letterhead + commune name). */
function buildCommuneDocumentDefaultBlocks(municipality) {
  return [
    ...buildOfficialHeaderBlocks(),
    headingBlock(municipality?.name_ar || "", municipality?.name_fr || ""),
    { type: "paragraph", text_ar: "", text_fr: "" },
  ];
}

function buildCommuneDocumentDefaultDataJson(municipality) {
  return buildDocumentDefaultDataJson({
    titleAr: municipality?.name_ar || "",
    titleFr: municipality?.name_fr || "",
  });
}

module.exports = {
  REPUBLIC_AR,
  REPUBLIC_FR,
  WILAYA_AR,
  WILAYA_FR,
  DIWAN_AR,
  DIWAN_FR,
  buildOfficialHeaderBlocks,
  buildOfficialHeaderHtml,
  buildDocumentDefaultBlocks,
  buildDocumentDefaultDataJson,
  buildFicheDefaultBlocks,
  buildFicheDefaultDataJson,
  buildCommuneDocumentDefaultBlocks,
  buildCommuneDocumentDefaultDataJson,
};
