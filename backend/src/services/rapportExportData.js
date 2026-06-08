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

async function loadExportData(rapportId, showHidden) {
  const rapport = await rapportService.getRapportDetail(rapportId);
  const kind = rapport.rapportType?.content_kind;
  let viewPart = {};
  let dataJson = {};

  if (kind === "table_grid") {
    viewPart = await workspaceService.getWaliTableView(rapportId, showHidden, false);
    const table = {
      rows: viewPart.rows,
      media_rows: viewPart.media_rows,
      title_ar: viewPart.tableMeta?.title_ar,
      title_fr: viewPart.tableMeta?.title_fr,
      subtitle_ar: viewPart.tableMeta?.subtitle_ar,
      subtitle_fr: viewPart.tableMeta?.subtitle_fr
    };
    dataJson = { tables: [table] };
  } else if (DOCUMENT_KINDS.has(kind)) {
    viewPart = await workspaceService.getWaliDocumentView(rapportId, false);
    dataJson = { blocks: viewPart.blocks };
  } else {
    const err = new Error("Export not supported for this rapport type");
    err.status = 400;
    throw err;
  }

  const { files } = await enrichDataJsonWithFiles(dataJson);
  const calendarEvents = await RapportCalendarEvent.findAll({
    where: { rapport_id: rapportId },
    order: [["event_date", "ASC"]]
  });

  return {
    rapport,
    kind,
    viewPart,
    files,
    calendarEvents: calendarEvents.map((e) => e.toJSON())
  };
}

module.exports = {
  DOCUMENT_KINDS,
  pickText,
  blockText,
  absFilePath,
  imageTypeFromFile,
  loadExportData
};
