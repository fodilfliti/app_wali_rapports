import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { signFileUrlsBatch } from "../api";

const DOWNLOAD_TOKEN_QUERY_RE = /([?&])(?:access_token|dl)=[^&#"'\s>]*/gi;
const FILE_ATTR_RE = /(src|href)=(["'])([^"']*?\/files\/[^"']*?)\2/gi;

/** Remove download tokens from /files URLs before persisting rich HTML. */
export function stripDownloadTokensFromHtml(html: string): string {
  if (!html) return html;
  let out = html.replace(DOWNLOAD_TOKEN_QUERY_RE, (_match, sep: string) =>
    sep === "?" ? "?" : "",
  );
  out = out.replace(/\?(["'#>\s])/g, "$1");
  out = out.replace(/\?&/g, "?");
  out = out.replace(/&&+/g, "&");
  return out;
}

/** @deprecated use stripDownloadTokensFromHtml */
export const stripAccessTokensFromHtml = stripDownloadTokensFromHtml;

function extractFilePaths(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(FILE_ATTR_RE)) {
    const raw = String(m[3]).replace(/\?.*$/, "").replace(/#.*$/, "");
    if (raw) set.add(raw);
  }
  return [...set];
}

function injectSignedUrls(html: string, signed: Map<string, string>): string {
  if (!signed.size) return html;
  return html.replace(FILE_ATTR_RE, (_m, attr, quote, url) => {
    const cleaned = String(url)
      .replace(DOWNLOAD_TOKEN_QUERY_RE, "")
      .replace(/[?&]$/, "")
      .replace(/\?$/, "");
    const signedUrl = signed.get(cleaned) || signed.get(cleaned.replace(/^\//, "")) || "";
    if (!signedUrl) return `${attr}=${quote}${cleaned}${quote}`;
    return `${attr}=${quote}${signedUrl}${quote}`;
  });
}

/** Sanitize rich HTML before dangerouslySetInnerHTML / TipTap hydrate. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "data-file-id",
      "data-schema-table-id",
      "data-spread-cols",
      "data-spread-slot",
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

/** Persist pipeline: strip tokens + sanitize. */
export function prepareRichHtmlForSave(html: string): string {
  return sanitizeRichHtml(stripDownloadTokensFromHtml(html || ""));
}

/** Sync sanitize for first paint (no signed URLs yet). */
export function prepareRichHtmlForDisplaySync(html: string): string {
  return sanitizeRichHtml(stripDownloadTokensFromHtml(html || ""));
}

/** React hook: sanitize + inject short-lived signed /files/ URLs for display. */
export function usePreparedRichHtml(html: string): string {
  const [prepared, setPrepared] = useState(() => prepareRichHtmlForDisplaySync(html));

  useEffect(() => {
    let cancelled = false;
    const clean = prepareRichHtmlForDisplaySync(html);
    const paths = extractFilePaths(clean);
    const pathsKey = paths.slice().sort().join("|");

    // Text-only changes: keep already-signed media srcs when file set unchanged.
    let reusedSigned = false;
    setPrepared((prev) => {
      const prevClean = prepareRichHtmlForDisplaySync(prev);
      const prevPathsKey = extractFilePaths(prevClean).slice().sort().join("|");
      if (pathsKey && pathsKey === prevPathsKey && prev !== clean && prev.includes("dl=")) {
        reusedSigned = true;
        return injectSignedUrlsFromPrevious(clean, prev);
      }
      return prepareRichHtmlForDisplaySync(prev) === clean ? prev : clean;
    });

    if (!paths.length || reusedSigned) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const signed = await signFileUrlsBatch(paths);
        if (!cancelled) {
          const withSigned = injectSignedUrls(clean, signed);
          setPrepared((prev) => (prev === withSigned ? prev : withSigned));
        }
      } catch {
        if (!cancelled) {
          setPrepared((prev) =>
            prepareRichHtmlForDisplaySync(prev) === clean ? prev : clean,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html]);

  return prepared;
}

/** Copy signed query strings from previous HTML onto matching /files/ paths in next. */
function injectSignedUrlsFromPrevious(cleanHtml: string, previousHtml: string): string {
  const signed = new Map<string, string>();
  for (const m of previousHtml.matchAll(FILE_ATTR_RE)) {
    const raw = String(m[3] || "");
    const path = raw.replace(/\?.*$/, "").replace(/#.*$/, "");
    if (path && /[?&]dl=/.test(raw)) signed.set(path, raw);
  }
  return signed.size ? injectSignedUrls(cleanHtml, signed) : cleanHtml;
}
