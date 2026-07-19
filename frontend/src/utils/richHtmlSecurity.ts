import DOMPurify from "dompurify";

const ACCESS_TOKEN_QUERY_RE = /([?&])access_token=[^&#"'\s>]*/gi;

/** Remove access JWTs from /files URLs before persisting rich HTML. */
export function stripAccessTokensFromHtml(html: string): string {
  if (!html) return html;
  let out = html.replace(ACCESS_TOKEN_QUERY_RE, (_match, sep: string) =>
    sep === "?" ? "?" : "",
  );
  // Clean leftover ? or & before closing quote/bracket
  out = out.replace(/\?(["'#>\s])/g, "$1");
  out = out.replace(/\?&/g, "?");
  out = out.replace(/&&+/g, "&");
  return out;
}

/** Append current access token to /files/... URLs for display only (never persist). */
export function injectAccessTokensIntoHtml(
  html: string,
  token: string | undefined | null,
): string {
  if (!html || !token) return html || "";
  const enc = encodeURIComponent(token);
  return html.replace(
    /(src|href)=(["'])([^"']*?\/files\/[^"']*?)\2/gi,
    (_m, attr, quote, url) => {
      let cleaned = String(url).replace(ACCESS_TOKEN_QUERY_RE, "").replace(/[?&]$/, "");
      cleaned = cleaned.replace(/\?$/, "");
      const sep = cleaned.includes("?") ? "&" : "?";
      return `${attr}=${quote}${cleaned}${sep}access_token=${enc}${quote}`;
    },
  );
}

/** Sanitize rich HTML before dangerouslySetInnerHTML / TipTap hydrate. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "data-file-id",
      "data-schema-table-id",
      "target",
      "rel",
      "colspan",
      "rowspan",
      "style",
      "class",
      "controls",
      "controlsList",
    ],
    ADD_TAGS: ["video", "source"],
    FORBID_TAGS: ["script", "object", "embed", "form", "iframe"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/** Display pipeline: strip stale tokens → sanitize → inject current token. */
export function prepareRichHtmlForDisplay(
  html: string,
  token?: string | null,
): string {
  const stripped = stripAccessTokensFromHtml(html || "");
  const clean = sanitizeRichHtml(stripped);
  return injectAccessTokensIntoHtml(clean, token);
}

/** Persist pipeline: strip tokens + sanitize. */
export function prepareRichHtmlForSave(html: string): string {
  return sanitizeRichHtml(stripAccessTokensFromHtml(html || ""));
}
