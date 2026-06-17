const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { storageRoot, ensureStorageDirs } = require("./storage");
const { UploadedFile } = require("../db");

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function classifyMime(mime) {
  if (IMAGE_MIMES.has(mime)) return "image";
  if (VIDEO_MIMES.has(mime)) return "video";
  return "file";
}

function maxBytesForMime(mime) {
  const kind = classifyMime(mime);
  if (kind === "image") return MAX_IMAGE_BYTES;
  if (kind === "video") return MAX_VIDEO_BYTES;
  return MAX_FILE_BYTES;
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^\w.\-() ]+/g, "_")
    .slice(0, 200);
}

async function saveUploadedBuffer({ buffer, originalName, mimeType, rapportId, actor, req }) {
  ensureStorageDirs();
  const mime = mimeType || "application/octet-stream";
  const max = maxBytesForMime(mime);
  if (!buffer || buffer.length > max) {
    const err = new Error("File too large");
    err.status = 413;
    throw err;
  }

  const storageKey = crypto.randomUUID().replace(/-/g, "");
  const ext = path.extname(originalName || "").slice(0, 12);
  const rel = path.join("uploads", `${storageKey}${ext}`);
  const abs = path.join(storageRoot(), rel);
  fs.writeFileSync(abs, buffer);

  const row = await UploadedFile.create({
    storage_key: storageKey,
    rapport_id: rapportId || null,
    uploaded_by_user_id: actor.id,
    original_name: sanitizeFilename(originalName),
    mime_type: mime,
    size_bytes: buffer.length,
    media_kind: classifyMime(mime),
    storage_rel_path: rel.replace(/\\/g, "/")
  });

  return serializeFile(row);
}

function serializeFile(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    storage_key: plain.storage_key,
    rapport_id: plain.rapport_id,
    original_name: plain.original_name,
    mime_type: plain.mime_type,
    size_bytes: plain.size_bytes,
    media_kind: plain.media_kind,
    storage_rel_path: plain.storage_rel_path,
    url_path: `/files/${plain.storage_rel_path}`
  };
}

function collectFileIdsFromRichHtml(html) {
  const ids = new Set();
  if (!html || typeof html !== "string") return ids;
  const attrRe = /data-file-id=["'](\d+)["']/gi;
  let match = attrRe.exec(html);
  while (match) {
    ids.add(Number(match[1]));
    match = attrRe.exec(html);
  }
  return ids;
}

async function getFilesByIds(ids) {
  if (!ids?.length) return [];
  const unique = [...new Set(ids.map(Number).filter(Boolean))];
  const rows = await UploadedFile.findAll({ where: { id: unique } });
  const map = new Map(rows.map((r) => [Number(r.id), serializeFile(r)]));
  return unique.map((id) => map.get(id)).filter(Boolean);
}

function collectStoragePathsFromRichHtml(html) {
  const paths = new Set();
  if (!html || typeof html !== "string") return paths;
  const srcRe = /src=["']([^"']+)["']/gi;
  let match = srcRe.exec(html);
  while (match) {
    const normalized = match[1].replace(/^https?:\/\/[^/]+/i, "");
    const pathMatch = normalized.match(/\/files\/(uploads\/[^?#]+)/i);
    if (pathMatch) paths.add(pathMatch[1].replace(/\\/g, "/"));
    match = srcRe.exec(html);
  }
  return paths;
}

async function collectFileIdsFromDataJson(dataJson) {
  const ids = new Set();
  const blocks = dataJson?.blocks || [];
  for (const b of blocks) {
    if (b.type === "media_row" && Array.isArray(b.items)) {
      for (const it of b.items) if (it.file_id) ids.add(Number(it.file_id));
    }
  }
  const tables = dataJson?.tables || [];
  for (const t of tables) {
    for (const row of t.media_rows || []) {
      for (const it of row.items || []) if (it.file_id) ids.add(Number(it.file_id));
    }
  }
  for (const row of dataJson?.media_rows || []) {
    for (const it of row.items || []) if (it.file_id) ids.add(Number(it.file_id));
  }
  const communes = dataJson?.communes || {};
  for (const entry of Object.values(communes)) {
    for (const row of entry?.media_rows || []) {
      for (const it of row.items || []) if (it.file_id) ids.add(Number(it.file_id));
    }
  }
  for (const id of collectFileIdsFromRichHtml(dataJson?.rich_html_ar)) ids.add(id);
  for (const id of collectFileIdsFromRichHtml(dataJson?.rich_html_fr)) ids.add(id);
  return [...ids];
}

async function enrichDataJsonWithFiles(dataJson, rapportId) {
  if (!dataJson) return { dataJson, files: {} };
  const ids = new Set(await collectFileIdsFromDataJson(dataJson));

  if (rapportId) {
    const rapportRows = await UploadedFile.findAll({ where: { rapport_id: Number(rapportId) } });
    for (const row of rapportRows) ids.add(Number(row.id));
  }

  const storagePaths = new Set([
    ...collectStoragePathsFromRichHtml(dataJson?.rich_html_ar),
    ...collectStoragePathsFromRichHtml(dataJson?.rich_html_fr)
  ]);
  if (storagePaths.size) {
    const byPath = await UploadedFile.findAll({
      where: { storage_rel_path: [...storagePaths] }
    });
    for (const row of byPath) ids.add(Number(row.id));
  }

  const files = await getFilesByIds([...ids]);
  const fileMap = Object.fromEntries(files.map((f) => [f.id, f]));
  return { dataJson, files: fileMap };
}

module.exports = {
  saveUploadedBuffer,
  serializeFile,
  getFilesByIds,
  collectFileIdsFromDataJson,
  collectFileIdsFromRichHtml,
  enrichDataJsonWithFiles,
  classifyMime,
  maxBytesForMime
};
