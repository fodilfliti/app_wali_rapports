/**
 * Official wilaya letterhead for fiche lecture / fichier complexe (commune) defaults.
 * Keep in sync with backend `modules/rapports/documentDefaults.js`.
 */

export const REPUBLIC_AR =
  "الجمهـــوريـــة الجـــزائريـــة الديمقـــراطيــــة الشعــبيــــة";
export const WILAYA_AR = "ولايــة تلمســان";
export const DIWAN_AR = "الديوان";

export type LetterheadOrgCtx = {
  orgScope?: "diwan" | "daira" | "commune" | "direction" | string;
  unitNameAr?: string;
  unitNameFr?: string;
};

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Third letterhead line from service org_scope (+ unit name when available). */
export function orgLetterheadThirdLineAr(ctx: LetterheadOrgCtx = {}): string {
  const scope = ctx.orgScope || "diwan";
  const nameAr = String(ctx.unitNameAr || "").trim();
  if (scope === "daira") return nameAr ? `دائرة ${nameAr}` : "الدائرة";
  if (scope === "commune") return nameAr ? `بلدية ${nameAr}` : "البلدية";
  if (scope === "direction") return nameAr ? `مديرية ${nameAr}` : "المديرية";
  return DIWAN_AR;
}

export function letterheadContextFromService(service: {
  org_scope?: string;
  daira?: { name_ar?: string; name_fr?: string } | null;
  municipality?: { name_ar?: string; name_fr?: string } | null;
  direction?: { name_ar?: string; name_fr?: string } | null;
} | null): LetterheadOrgCtx {
  if (!service) return { orgScope: "diwan" };
  const orgScope = service.org_scope || "diwan";
  let unit: { name_ar?: string; name_fr?: string } | null = null;
  if (orgScope === "daira") unit = service.daira || null;
  else if (orgScope === "commune") unit = service.municipality || null;
  else if (orgScope === "direction") unit = service.direction || null;
  return {
    orgScope,
    unitNameAr: unit?.name_ar || "",
    unitNameFr: unit?.name_fr || "",
  };
}

function letterheadHtml(ctx: LetterheadOrgCtx = {}): string {
  return [REPUBLIC_AR, WILAYA_AR, orgLetterheadThirdLineAr(ctx)]
    .map(
      (line) =>
        `<p style="text-align: center"><strong>${escapeHtml(line)}</strong></p>`,
    )
    .join("");
}

/** New fiche / document body: letterhead + optional title (normal-size letterhead). */
export function buildDocumentDefaultRichHtmlAr(
  titleAr?: string,
  opts?: { titleAsH3?: boolean } & LetterheadOrgCtx,
): string {
  const title = String(titleAr || "").trim();
  const tag = opts?.titleAsH3 ? "h3" : "h2";
  const titlePart = title
    ? `<${tag} style="text-align: center">${escapeHtml(title)}</${tag}>`
    : "";
  const ctx: LetterheadOrgCtx = {
    orgScope: opts?.orgScope,
    unitNameAr: opts?.unitNameAr,
    unitNameFr: opts?.unitNameFr,
  };
  return `${letterheadHtml(ctx)}${titlePart}<p></p>`;
}

/** Fiche lecture default title as H3. */
export function buildFicheDefaultRichHtmlAr(ctx?: LetterheadOrgCtx): string {
  return buildDocumentDefaultRichHtmlAr("مذكرة استخلاصية", {
    titleAsH3: true,
    ...ctx,
  });
}

/** Commune complex entity: letterhead + commune name. */
export function buildCommuneDefaultRichHtmlAr(
  nameAr?: string,
  ctx?: LetterheadOrgCtx,
): string {
  return buildDocumentDefaultRichHtmlAr(nameAr || "", ctx);
}
