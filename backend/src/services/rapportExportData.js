const fs = require("fs");
const path = require("path");
const { RapportCalendarEvent } = require("../db");
const rapportService = require("../modules/rapports/rapportService");
const workspaceService = require("../modules/rapports/workspaceService");
const { enrichDataJsonWithFiles } = require("./uploadService");
const { storageRoot } = require("./storage");

const DOCUMENT_KINDS = new Set(["document_compose", "fiche_lecture"]);

function pickText(obj, locale, arKey, frKey) {
  if (!obj) return "";
  if (locale === "fr") return String(obj[frKey] ?? obj[arKey] ?? "");
  return String(obj[arKey] ?? obj[frKey] ?? "");
}

function blockText(block, locale) {
  if (locale === "fr") return block.text_fr ?? block.text ?? "";
  return block.text_ar ?? block.text ?? "";
}

function absFilePath(file) {
  if (!file?.storage_rel_path) return null;
  const abs = path.join(storageRoot(), file.storage_rel_path);
  return fs.existsSync(abs) ? abs : null;
}

/** Resolve uploaded image path from editor src URL (/files/uploads/...). */
function absPathFromUploadsUrl(src) {
  if (!src) return null;
  const normalized = String(src).replace(/^https?:\/\/[^/]+/i, "");
  const match = normalized.match(/\/files\/(uploads\/[^?#]+)/i);
  if (!match) return null;
  const rel = match[1].replace(/\\/g, "/");
  const abs = path.join(storageRoot(), rel);
  return fs.existsSync(abs) ? abs : null;
}

function imageTypeFromFile(file, absPath) {
  const mime = file?.mime_type || "";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  const ext = path.extname(absPath || file?.original_name || "").toLowerCase();
  if (ext === ".png") return "png";
  if (ext === ".gif") return "gif";
  return "jpg";
}

async function loadExportData(rapportId, showHidden, versionId = null) {
  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  const kind = rapport.rapportType?.content_kind;
  let viewPart = {};
  let dataJson = {};

  if (kind === "table_grid") {
    viewPart = await workspaceService.getWaliTableView(
      rapportId,
      showHidden,
      false,
      versionId,
    );
    viewPart.columns = viewPart.schema?.columns || [];
    viewPart.layoutJson = viewPart.schema?.layout_json || {};
    const table = {
      rows: viewPart.rows,
      media_rows: viewPart.media_rows,
      title_ar: viewPart.tableMeta?.title_ar,
      title_fr: viewPart.tableMeta?.title_fr,
      subtitle_ar: viewPart.tableMeta?.subtitle_ar,
      subtitle_fr: viewPart.tableMeta?.subtitle_fr,
      merge_column_keys: viewPart.tableMeta?.merge_column_keys || [],
    };
    dataJson = { tables: [table] };
  } else if (DOCUMENT_KINDS.has(kind)) {
    viewPart = await workspaceService.getWaliDocumentView(rapportId, false, versionId);
    const dj = rapport.currentVersion?.data_json || {};
    dataJson = {
      blocks: viewPart.blocks,
      rich_html_ar: dj.rich_html_ar,
      rich_html_fr: dj.rich_html_fr,
      embedded_tables: dj.embedded_tables || [],
      media_rows: dj.media_rows || [],
    };
    viewPart.media_rows = dj.media_rows || [];
  } else if (kind === "commune_list") {
    viewPart = await workspaceService.getWaliCommuneView(rapportId, versionId, false);
    if (!viewPart.schema) {
      const err = new Error("tableSchemaNotConfigured");
      err.status = 400;
      throw err;
    }
    const columns = viewPart.schema.columns || [];
    const layoutJson = viewPart.schema.layout_json || {};

    // Group rows from all communes into a single table
    const allRows = [];
    const municipalities = viewPart.municipalities || [];
    const communesData = viewPart.communes || {};

    for (const m of municipalities) {
      const entry = communesData[m.code] || {};
      const rows = entry.rows || [];
      for (const r of rows) {
        allRows.push({
          ...r,
          _municipality_name_ar: m.name_ar,
          _municipality_name_fr: m.name_fr,
          _municipality_code: m.code
        });
      }
    }

    dataJson = {
      tables: [{
        key: "communes",
        rows: allRows,
        title_ar: rapport.title_ar,
        title_fr: rapport.title_fr
      }]
    };

    // Synthesize viewPart structure needed for Excel
    viewPart.columns = columns;
    viewPart.layoutJson = layoutJson;

  } else {
    const err = new Error("Export not supported for this rapport type");
    err.status = 400;
    throw err;
  }

  const { files } = await enrichDataJsonWithFiles(dataJson, rapportId);
  const numericRapportId = await rapportService.resolveNumericRapportId(rapportId);
  const calendarEvents = numericRapportId
    ? await RapportCalendarEvent.findAll({
        where: { rapport_id: numericRapportId },
        order: [["event_date", "ASC"]],
      })
    : [];

  return {
    rapport,
    kind,
    viewPart,
    dataJson,
    files,
    calendarEvents: calendarEvents.map((e) => e.toJSON())
  };
}

module.exports = {
  DOCUMENT_KINDS,
  pickText,
  blockText,
  absFilePath,
  absPathFromUploadsUrl,
  imageTypeFromFile,
  loadExportData
};
