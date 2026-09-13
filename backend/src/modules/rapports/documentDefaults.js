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

/**
 * Third letterhead line from service org_scope (+ unit name when available).
 * @param {{ orgScope?: string, unitNameAr?: string, unitNameFr?: string }} [ctx]
 */
function orgLetterheadThirdLine(ctx = {}) {
  const scope = ctx.orgScope || "diwan";
  const nameAr = String(ctx.unitNameAr || "").trim();
  const nameFr = String(ctx.unitNameFr || "").trim() || nameAr;

  if (scope === "daira") {
    return {
      ar: nameAr ? `دائرة ${nameAr}` : "الدائرة",
      fr: nameFr ? `Daïra de ${nameFr}` : "La Daïra",
    };
  }
  if (scope === "commune") {
    return {
      ar: nameAr ? `بلدية ${nameAr}` : "البلدية",
      fr: nameFr ? `Commune de ${nameFr}` : "La Commune",
    };
  }
  if (scope === "direction") {
    return {
      ar: nameAr ? `مديرية ${nameAr}` : "المديرية",
      fr: nameFr ? `Direction ${nameFr}` : "La Direction",
    };
  }
  return { ar: DIWAN_AR, fr: DIWAN_FR };
}

/** Extract letterhead context from a Service row (with optional unit includes). */
function letterheadContextFromService(service) {
  if (!service) return { orgScope: "diwan", unitNameAr: "", unitNameFr: "" };
  const orgScope = service.org_scope || "diwan";
  let unit = null;
  if (orgScope === "daira") unit = service.daira || null;
  else if (orgScope === "commune") unit = service.municipality || null;
  else if (orgScope === "direction") unit = service.direction || null;
  return {
    orgScope,
    unitNameAr: unit?.name_ar || "",
    unitNameFr: unit?.name_fr || "",
  };
}

/** Standard wilaya letterhead blocks (republic, wilaya, org line — editable after creation). */
function buildOfficialHeaderBlocks(letterheadCtx = {}) {
  const third = orgLetterheadThirdLine(letterheadCtx);
  return [
    letterheadLineBlock(REPUBLIC_AR, REPUBLIC_FR),
    letterheadLineBlock(WILAYA_AR, WILAYA_FR),
    letterheadLineBlock(third.ar, third.fr),
  ];
}

function buildOfficialHeaderHtml(locale = "ar", letterheadCtx = {}) {
  const third = orgLetterheadThirdLine(letterheadCtx);
  const lines =
    locale === "fr"
      ? [REPUBLIC_FR, WILAYA_FR, third.fr]
      : [REPUBLIC_AR, WILAYA_AR, third.ar];
  return lines.map(letterheadHtmlLine).join("");
}

/** TipTap / rich_html default for documents & fiches (letterhead + optional title). */
function buildDocumentDefaultDataJson({
  titleAr,
  titleFr,
  titleAsH3 = false,
  orgScope,
  unitNameAr,
  unitNameFr,
} = {}) {
  const letterheadCtx = { orgScope, unitNameAr, unitNameFr };
  return {
    rich_html_ar:
      buildOfficialHeaderHtml("ar", letterheadCtx) +
      titleHtml(titleAr, { asH3: titleAsH3 }) +
      "<p></p>",
    rich_html_fr:
      buildOfficialHeaderHtml("fr", letterheadCtx) +
      titleHtml(titleFr, { asH3: titleAsH3 }) +
      "<p></p>",
    blocks: buildDocumentDefaultBlocks({
      titleAr,
      titleFr,
      titleLevel: titleAsH3 ? 3 : 2,
      ...letterheadCtx,
    }),
    embedded_tables: [],
  };
}

function titleHtml(text, { asH3 = false } = {}) {
  const t = String(text || "").trim();
  if (!t) return "";
  const tag = asH3 ? "h3" : "h2";
  return `<${tag} style="text-align: center">${escapeHtml(t)}</${tag}>`;
}

/** Default blocks for document_compose / fiche_lecture when no template is set. */
function buildDocumentDefaultBlocks({
  titleAr,
  titleFr,
  titleLevel = 2,
  orgScope,
  unitNameAr,
  unitNameFr,
} = {}) {
  const blocks = [...buildOfficialHeaderBlocks({ orgScope, unitNameAr, unitNameFr })];
  if (titleAr || titleFr) {
    blocks.push(headingBlock(titleAr || "", titleFr || "", "center", titleLevel));
  }
  blocks.push({ type: "paragraph", text_ar: "", text_fr: "" });
  return blocks;
}

function buildFicheDefaultBlocks(letterheadCtx = {}) {
  return buildDocumentDefaultBlocks({
    titleAr: "مذكرة استخلاصية",
    titleFr: "Fiche lecture",
    titleLevel: 3,
    ...letterheadCtx,
  });
}

function buildFicheDefaultDataJson(letterheadCtx = {}) {
  return buildDocumentDefaultDataJson({
    titleAr: "مذكرة استخلاصية",
    titleFr: "Fiche lecture",
    titleAsH3: true,
    ...letterheadCtx,
  });
}

/** Default blocks for a commune complex document (letterhead + commune name). */
function buildCommuneDocumentDefaultBlocks(municipality, letterheadCtx = {}) {
  return [
    ...buildOfficialHeaderBlocks(letterheadCtx),
    headingBlock(municipality?.name_ar || "", municipality?.name_fr || ""),
    { type: "paragraph", text_ar: "", text_fr: "" },
  ];
}

function buildCommuneDocumentDefaultDataJson(municipality, letterheadCtx = {}) {
  return buildDocumentDefaultDataJson({
    titleAr: municipality?.name_ar || "",
    titleFr: municipality?.name_fr || "",
    ...letterheadCtx,
  });
}

module.exports = {
  REPUBLIC_AR,
  REPUBLIC_FR,
  WILAYA_AR,
  WILAYA_FR,
  DIWAN_AR,
  DIWAN_FR,
  orgLetterheadThirdLine,
  letterheadContextFromService,
  buildOfficialHeaderBlocks,
  buildOfficialHeaderHtml,
  buildDocumentDefaultBlocks,
  buildDocumentDefaultDataJson,
  buildFicheDefaultBlocks,
  buildFicheDefaultDataJson,
  buildCommuneDocumentDefaultBlocks,
  buildCommuneDocumentDefaultDataJson,
};
