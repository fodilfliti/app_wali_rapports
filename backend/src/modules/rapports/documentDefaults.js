const REPUBLIC_AR =
  "الجمهـــوريـــة الجـــزائريـــة الديمقـــراطيــــة الشعــبيــــة";
const REPUBLIC_FR = "République Algérienne Démocratique et Populaire";
const WILAYA_AR = "ولايــة تلمســان";
const WILAYA_FR = "Wilaya de Tlemcen";
const DIWAN_AR = "الديوان";
const DIWAN_FR = "Le Diwan";

function headingBlock(textAr, textFr, align = "center") {
  return {
    type: "heading",
    align,
    bold: true,
    text_ar: textAr || "",
    text_fr: textFr || "",
  };
}

/** Standard wilaya letterhead blocks (republic, wilaya, diwan — editable by user after creation). */
function buildOfficialHeaderBlocks() {
  return [
    headingBlock(REPUBLIC_AR, REPUBLIC_FR),
    headingBlock(WILAYA_AR, WILAYA_FR),
    headingBlock(DIWAN_AR, DIWAN_FR),
  ];
}

/** Default blocks for document_compose / fiche_lecture when no template is set. */
function buildDocumentDefaultBlocks({ titleAr, titleFr } = {}) {
  return [
    ...buildOfficialHeaderBlocks(),
    headingBlock(titleAr || "", titleFr || ""),
    { type: "paragraph", text_ar: "", text_fr: "" },
  ];
}

function buildFicheDefaultBlocks() {
  return buildDocumentDefaultBlocks({
    titleAr: "مذكرة استخلاصية",
    titleFr: "Fiche lecture",
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

module.exports = {
  REPUBLIC_AR,
  REPUBLIC_FR,
  WILAYA_AR,
  WILAYA_FR,
  DIWAN_AR,
  DIWAN_FR,
  buildOfficialHeaderBlocks,
  buildDocumentDefaultBlocks,
  buildFicheDefaultBlocks,
  buildCommuneDocumentDefaultBlocks,
};
