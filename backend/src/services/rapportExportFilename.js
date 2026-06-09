function sanitizeFilenamePart(text) {
  return (
    String(text || "")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 120) || "rapport"
  );
}

function formatExportDate(rapport) {
  const raw = rapport?.reference_date || rapport?.updated_at || rapport?.created_at;
  if (!raw) return new Date().toISOString().slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return d.toISOString().slice(0, 10);
}

function rapportExportFilename(rapport, ext) {
  const title = sanitizeFilenamePart(rapport?.title);
  const date = formatExportDate(rapport);
  const extension = String(ext || "pdf").replace(/^\./, "");
  return `${title} - ${date}.${extension}`;
}

/** Content-Disposition with UTF-8 filename (Arabic titles). */
function contentDispositionAttachment(filename) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/_+/g, "_") || "export";
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

module.exports = {
  rapportExportFilename,
  contentDispositionAttachment
};
