const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { storageRoot, ensureStorageDirs } = require("./storage");
const { UploadedFile } = require("../db");
const { getLogger } = require("../logger");
const { findByPublicId, publicId, isUuid } = require("../modules/access/idResolver");

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const DOC_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const ALLOWED_MIMES = new Set([...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES]);
const BLOCKED_EXT = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".cjs",
  ".php",
  ".phtml",
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".dll",
  ".jar",
  ".wasm",
]);
const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".pptx",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function uploadsTempDir() {
  return path.join(storageRoot(), "uploads", ".tmp");
}

function ensureUploadTempDir() {
  ensureStorageDirs();
  const dir = uploadsTempDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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

function isAllowedUpload(mime, originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  if (BLOCKED_EXT.has(ext)) return false;
  if (ext && !ALLOWED_EXT.has(ext)) return false;
  const m = mime || "application/octet-stream";
  if (/^text\/html|^image\/svg|^application\/javascript|^text\/javascript|^text\/xml/i.test(m)) {
    return false;
  }
  if (!ALLOWED_MIMES.has(m) && ext && ALLOWED_EXT.has(ext)) {
    return true;
  }
  return ALLOWED_MIMES.has(m);
}

function sniffLooksDangerous(buffer) {
  if (!buffer || buffer.length < 4) return false;
  const head = buffer.slice(0, 256).toString("utf8").toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html") || head.includes("<svg")) return true;
  return false;
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^\w.\-() ]+/g, "_")
    .slice(0, 200);
}

function resolveExtension(originalName, mime) {
  let ext = path.extname(originalName || "").slice(0, 12).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    ext = IMAGE_MIMES.has(mime)
      ? ".jpg"
      : VIDEO_MIMES.has(mime)
        ? ".mp4"
        : mime === "application/pdf"
          ? ".pdf"
          : ".bin";
    if (ext === ".bin") {
      const err = new Error("File type not allowed");
      err.status = 400;
      throw err;
    }
  }
  return ext;
}

function contentTypeGuess(ext) {
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] || "application/octet-stream";
}

function logUploadComplete({ req, mediaKind, sizeBytes, durationMs }) {
  const logger = req?.log || getLogger();
  logger.info(
    {
      upload: { media_kind: mediaKind, size_bytes: sizeBytes, duration_ms: durationMs },
      userId: req?.user?.id,
      requestId: req?.requestId,
    },
    "upload complete",
  );
}

async function removeDiskFile(relPath) {
  if (!relPath) return;
  const abs = path.join(storageRoot(), relPath);
  try {
    await fsp.unlink(abs);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

async function deleteUploadedFileById(fileId) {
  const row = await findByPublicId(UploadedFile, fileId);
  if (!row) return false;
  await removeDiskFile(row.storage_rel_path);
  await row.destroy();
  return true;
}

async function readFileHead(sourcePath, max = 256) {
  const handle = await fsp.open(sourcePath, "r");
  try {
    const stat = await handle.stat();
    const len = Math.min(max, stat.size);
    const buf = Buffer.alloc(len);
    await handle.read(buf, 0, len, 0);
    return { head: buf, size: stat.size };
  } finally {
    await handle.close();
  }
}

async function saveUploadedFile({
  sourcePath,
  buffer,
  originalName,
  mimeType,
  rapportId,
  actor,
  req,
  startedAt,
}) {
  ensureStorageDirs();
  const mime = mimeType || "application/octet-stream";
  if (!isAllowedUpload(mime, originalName)) {
    const err = new Error("File type not allowed");
    err.status = 400;
    throw err;
  }

  let sizeBytes;
  let headBuffer;
  if (sourcePath) {
    const { head, size } = await readFileHead(sourcePath);
    headBuffer = head;
    sizeBytes = size;
  } else {
    headBuffer = buffer;
    sizeBytes = buffer?.length || 0;
  }

  if (sniffLooksDangerous(headBuffer)) {
    const err = new Error("File type not allowed");
    err.status = 400;
    throw err;
  }

  let numericRapportId = null;
  if (rapportId) {
    const { resolveNumericRapportId } = require("../modules/rapports/rapportService");
    numericRapportId = await resolveNumericRapportId(rapportId);
  }

  const max = maxBytesForMime(mime);
  if (!sizeBytes || sizeBytes > max) {
    const err = new Error("File too large");
    err.status = 413;
    throw err;
  }

  const storageKey = crypto.randomUUID().replace(/-/g, "");
  const ext = resolveExtension(originalName, mime);
  const rel = path.join("uploads", `${storageKey}${ext}`).replace(/\\/g, "/");
  const abs = path.join(storageRoot(), rel);

  if (sourcePath) {
    await fsp.rename(sourcePath, abs);
  } else {
    await fsp.writeFile(abs, buffer);
  }

  const row = await UploadedFile.create({
    storage_key: storageKey,
    rapport_id: numericRapportId,
    uploaded_by_user_id: actor.id,
    original_name: sanitizeFilename(originalName),
    mime_type: ALLOWED_MIMES.has(mime) ? mime : contentTypeGuess(ext),
    size_bytes: sizeBytes,
    media_kind: classifyMime(mime),
    storage_rel_path: rel,
  });

  const durationMs = startedAt ? Date.now() - startedAt : undefined;
  logUploadComplete({
    req,
    mediaKind: classifyMime(mime),
    sizeBytes,
    durationMs,
  });

  return serializeFile(row);
}

async function saveUploadedBuffer(opts) {
  return saveUploadedFile({ ...opts, buffer: opts.buffer, sourcePath: null });
}

function serializeFile(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: publicId(plain),
    storage_key: plain.storage_key,
    rapport_id: plain.rapport_id,
    original_name: plain.original_name,
    mime_type: plain.mime_type,
    size_bytes: plain.size_bytes,
    media_kind: plain.media_kind,
    storage_rel_path: plain.storage_rel_path,
    url_path: `/files/${plain.storage_rel_path}`,
  };
}

function collectFileIdsFromRichHtml(html) {
  const ids = new Set();
  if (!html || typeof html !== "string") return ids;
  // Legacy numeric + UUID public ids in data-file-id.
  const attrRe = /data-file-id=["']([^"']+)["']/gi;
  let match = attrRe.exec(html);
  while (match) {
    const raw = String(match[1] || "").trim();
    if (raw) ids.add(raw);
    match = attrRe.exec(html);
  }
  return ids;
}

async function findUploadedFileRows(ids) {
  if (!ids?.length) return [];
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  const numericIds = [];
  const uuidIds = [];
  for (const id of unique) {
    if (isUuid(id)) uuidIds.push(id);
    else {
      const n = Number(id);
      if (Number.isFinite(n) && n > 0) numericIds.push(n);
    }
  }
  const where = [];
  if (numericIds.length) where.push({ id: numericIds });
  if (uuidIds.length) where.push({ uuid: uuidIds });
  if (!where.length) return [];
  const { Op } = require("sequelize");
  return UploadedFile.findAll({
    where: where.length === 1 ? where[0] : { [Op.or]: where },
  });
}

/** Index by public UUID and legacy BIGINT so pre-migration file_id lookups work. */
function buildDualKeyFileMap(rows) {
  const fileMap = {};
  for (const row of rows || []) {
    const serialized = serializeFile(row);
    const pub = publicId(row);
    if (pub != null) fileMap[String(pub)] = serialized;
    if (row.id != null) fileMap[String(row.id)] = serialized;
  }
  return fileMap;
}

async function getFilesByIds(ids) {
  if (!ids?.length) return [];
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  const rows = await findUploadedFileRows(unique);
  const byPublic = new Map(rows.map((r) => [String(publicId(r)), serializeFile(r)]));
  const byNumeric = new Map(rows.map((r) => [String(r.id), serializeFile(r)]));
  return unique
    .map((id) => byPublic.get(id) || byNumeric.get(id))
    .filter(Boolean);
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

function addFileRef(ids, fileId) {
  if (fileId == null || fileId === "") return;
  ids.add(String(fileId));
}

function collectFileIdsFromEntityEntry(ids, entry) {
  if (!entry || typeof entry !== "object") return;
  for (const row of entry.media_rows || []) {
    for (const it of row.items || []) addFileRef(ids, it.file_id);
  }
  for (const id of collectFileIdsFromRichHtml(entry.rich_html_ar)) ids.add(id);
  for (const id of collectFileIdsFromRichHtml(entry.rich_html_fr)) ids.add(id);
  const blocks = entry.blocks || [];
  for (const b of blocks) {
    if (b.type === "media_row" && Array.isArray(b.items)) {
      for (const it of b.items) addFileRef(ids, it.file_id);
    }
  }
}

async function collectFileIdsFromDataJson(dataJson) {
  const ids = new Set();
  const blocks = dataJson?.blocks || [];
  for (const b of blocks) {
    if (b.type === "media_row" && Array.isArray(b.items)) {
      for (const it of b.items) addFileRef(ids, it.file_id);
    }
  }
  const tables = dataJson?.tables || [];
  for (const t of tables) {
    for (const row of t.media_rows || []) {
      for (const it of row.items || []) addFileRef(ids, it.file_id);
    }
  }
  for (const row of dataJson?.media_rows || []) {
    for (const it of row.items || []) addFileRef(ids, it.file_id);
  }
  const communes = dataJson?.communes || {};
  for (const entry of Object.values(communes)) {
    collectFileIdsFromEntityEntry(ids, entry);
  }
  const entities = dataJson?.entities || {};
  for (const entry of Object.values(entities)) {
    collectFileIdsFromEntityEntry(ids, entry);
  }
  for (const id of collectFileIdsFromRichHtml(dataJson?.rich_html_ar)) ids.add(id);
  for (const id of collectFileIdsFromRichHtml(dataJson?.rich_html_fr)) ids.add(id);
  return [...ids];
}

async function enrichDataJsonWithFiles(dataJson, rapportId) {
  if (!dataJson) return { dataJson, files: {} };
  const ids = new Set(await collectFileIdsFromDataJson(dataJson));
  const extraRows = [];

  if (rapportId) {
    const { resolveNumericRapportId } = require("../modules/rapports/rapportService");
    const numericRapportId = await resolveNumericRapportId(rapportId);
    if (numericRapportId) {
      const rapportRows = await UploadedFile.findAll({
        where: { rapport_id: numericRapportId },
      });
      for (const row of rapportRows) {
        ids.add(String(publicId(row)));
        ids.add(String(row.id));
        extraRows.push(row);
      }
    }
  }

  const storagePaths = new Set([
    ...collectStoragePathsFromRichHtml(dataJson?.rich_html_ar),
    ...collectStoragePathsFromRichHtml(dataJson?.rich_html_fr),
  ]);
  if (storagePaths.size) {
    const byPath = await UploadedFile.findAll({
      where: { storage_rel_path: [...storagePaths] },
    });
    for (const row of byPath) {
      ids.add(String(publicId(row)));
      ids.add(String(row.id));
      extraRows.push(row);
    }
  }

  const rowsById = new Map();
  for (const row of extraRows) rowsById.set(Number(row.id), row);
  for (const row of await findUploadedFileRows([...ids])) {
    rowsById.set(Number(row.id), row);
  }
  return { dataJson, files: buildDualKeyFileMap([...rowsById.values()]) };
}

async function cleanupTempFile(sourcePath) {
  if (!sourcePath) return;
  try {
    await fsp.unlink(sourcePath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

function multerFileInput(file) {
  if (!file) return null;
  return {
    sourcePath: file.path || null,
    buffer: file.buffer || null,
    originalName: file.originalname,
    mimeType: file.mimetype,
  };
}

module.exports = {
  saveUploadedBuffer,
  saveUploadedFile,
  deleteUploadedFileById,
  cleanupTempFile,
  multerFileInput,
  serializeFile,
  getFilesByIds,
  buildDualKeyFileMap,
  collectFileIdsFromDataJson,
  collectFileIdsFromRichHtml,
  enrichDataJsonWithFiles,
  classifyMime,
  maxBytesForMime,
  isAllowedUpload,
  ensureUploadTempDir,
  uploadsTempDir,
};