/**
 * Official wilaya letterhead for fiche lecture / fichier complexe (commune) defaults.
 * Keep in sync with backend `modules/rapports/documentDefaults.js`.
 */

export const REPUBLIC_AR =
  "الجمهـــوريـــة الجـــزائريـــة الديمقـــراطيــــة الشعــبيــــة";
export const WILAYA_AR = "ولايــة تلمســان";
export const DIWAN_AR = "الديوان";

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letterheadHtml(): string {
  return [REPUBLIC_AR, WILAYA_AR, DIWAN_AR]
    .map(
      (line) =>
        `<p style="text-align: center"><strong>${escapeHtml(line)}</strong></p>`,
    )
    .join("");
}

/** New fiche / document body: letterhead + optional title (normal-size letterhead). */
export function buildDocumentDefaultRichHtmlAr(
  titleAr?: string,
  opts?: { titleAsH3?: boolean },
): string {
  const title = String(titleAr || "").trim();
  const tag = opts?.titleAsH3 ? "h3" : "h2";
  const titlePart = title
    ? `<${tag} style="text-align: center">${escapeHtml(title)}</${tag}>`
    : "";
  return `${letterheadHtml()}${titlePart}<p></p>`;
}

/** Fiche lecture default title as H3. */
export function buildFicheDefaultRichHtmlAr(): string {
  return buildDocumentDefaultRichHtmlAr("مذكرة استخلاصية", { titleAsH3: true });
}

/** Commune complex entity: letterhead + commune name. */
export function buildCommuneDefaultRichHtmlAr(nameAr?: string): string {
  return buildDocumentDefaultRichHtmlAr(nameAr || "");
}
