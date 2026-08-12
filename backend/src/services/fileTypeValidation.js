const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const FileType = require("file-type");

/** Allowed true types after magic-byte / OOXML refinement */
const ALLOWED_BY_EXT = {
  ".jpg": { mime: "image/jpeg", mediaKind: "image" },
  ".jpeg": { mime: "image/jpeg", mediaKind: "image" },
  ".png": { mime: "image/png", mediaKind: "image" },
  ".gif": { mime: "image/gif", mediaKind: "image" },
  ".webp": { mime: "image/webp", mediaKind: "image" },
  ".mp4": { mime: "video/mp4", mediaKind: "video" },
  ".webm": { mime: "video/webm", mediaKind: "video" },
  ".mov": { mime: "video/quicktime", mediaKind: "video" },
  ".pdf": { mime: "application/pdf", mediaKind: "file" },
  ".doc": { mime: "application/msword", mediaKind: "file" },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mediaKind: "file",
  },
  ".xls": { mime: "application/vnd.ms-excel", mediaKind: "file" },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mediaKind: "file",
  },
  ".pptx": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    mediaKind: "file",
  },
};

const FILE_TYPE_EXT_MAP = {
  jpg: ".jpg",
  jpeg: ".jpg",
  png: ".png",
  gif: ".gif",
  webp: ".webp",
  mp4: ".mp4",
  webm: ".webm",
  mov: ".mov",
  qt: ".mov",
  pdf: ".pdf",
};

const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b]); // PK
const PDF_MAGIC = Buffer.from("%PDF");

function invalidTypeError(message = "Invalid or mismatched file type") {
  const err = new Error(message);
  err.status = 400;
  err.code = "INVALID_FILE_TYPE";
  return err;
}

async function readHead(filePath, max = 16_384) {
  const handle = await fsp.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const len = Math.min(max, stat.size);
    const buf = Buffer.alloc(len);
    if (len > 0) await handle.read(buf, 0, len, 0);
    return { head: buf, size: stat.size };
  } finally {
    await handle.close();
  }
}

function bufferStartsWith(buf, magic) {
  if (!buf || buf.length < magic.length) return false;
  return buf.subarray(0, magic.length).equals(magic);
}

/**
 * OOXML (docx/xlsx/pptx) are ZIP containers — file-type reports zip.
 * Peek local headers / early bytes for package paths.
 */
function refineOoxmlFromZipHead(head) {
  if (!bufferStartsWith(head, ZIP_MAGIC)) return null;
  const ascii = head.toString("latin1");
  if (ascii.includes("word/") || ascii.includes("word\\")) return ".docx";
  if (ascii.includes("xl/") || ascii.includes("xl\\")) return ".xlsx";
  if (ascii.includes("ppt/") || ascii.includes("ppt\\")) return ".pptx";
  return null;
}

function detectOleFamily(head) {
  return bufferStartsWith(head, OLE_MAGIC);
}

function detectPdf(head) {
  // PDF may have a short BOM / whitespace before %PDF
  const slice = head.subarray(0, Math.min(head.length, 1024)).toString("latin1");
  return slice.includes("%PDF");
}

function claimedExt(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  return ALLOWED_BY_EXT[ext] ? ext : "";
}

/**
 * Detect true type from disk bytes. Does not trust client mime/name alone.
 * @returns {Promise<{ ext: string, mime: string, mediaKind: string }>}
 */
async function detectTrueFileType(filePath, originalName) {
  const { head, size } = await readHead(filePath);
  if (!size) throw invalidTypeError();

  let detectedExt = null;

  // Prefer dedicated sniffers for formats file-type mishandles or under-reports
  if (detectPdf(head)) {
    detectedExt = ".pdf";
  } else if (detectOleFamily(head)) {
    // Legacy OLE: cannot reliably distinguish .doc vs .xls from magic alone.
    // Require claimed extension to be one of the OLE office types, and only after OLE magic matches.
    const claimed = claimedExt(originalName);
    if (claimed === ".doc" || claimed === ".xls") {
      detectedExt = claimed;
    } else {
      throw invalidTypeError();
    }
  } else {
    const ooxml = refineOoxmlFromZipHead(head);
    if (ooxml) {
      detectedExt = ooxml;
    } else {
      let ft = null;
      try {
        ft = await FileType.fromFile(filePath);
      } catch {
        ft = null;
      }
      if (!ft && head.length) {
        try {
          ft = await FileType.fromBuffer(head);
        } catch {
          ft = null;
        }
      }
      if (ft?.ext) {
        const mapped = FILE_TYPE_EXT_MAP[String(ft.ext).toLowerCase()];
        if (mapped) detectedExt = mapped;
        else if (ft.mime === "application/zip" || ft.ext === "zip") {
          // ZIP but not recognized OOXML → reject (not a bare zip allowlist)
          throw invalidTypeError();
        } else {
          throw invalidTypeError();
        }
      }
    }
  }

  if (!detectedExt || !ALLOWED_BY_EXT[detectedExt]) {
    throw invalidTypeError();
  }

  // If client sent an allowed extension, it must match the detected type
  // (e.g. .exe renamed to .xlsx fails because detected ≠ xlsx).
  const claimed = claimedExt(originalName);
  const normalizeExt = (e) => (e === ".jpeg" ? ".jpg" : e);
  if (claimed && normalizeExt(claimed) !== normalizeExt(detectedExt)) {
    throw invalidTypeError();
  }

  const resolvedExt = normalizeExt(detectedExt);
  const meta = ALLOWED_BY_EXT[resolvedExt] || ALLOWED_BY_EXT[detectedExt];
  return { ext: resolvedExt, mime: meta.mime, mediaKind: meta.mediaKind };
}

/**
 * Validate temp upload; delete on failure (sync unlink as safety net).
 */
async function assertValidUploadFileType(filePath, originalName) {
  try {
    return await detectTrueFileType(filePath, originalName);
  } catch (err) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    if (err.status) throw err;
    throw invalidTypeError();
  }
}

module.exports = {
  detectTrueFileType,
  assertValidUploadFileType,
  ALLOWED_BY_EXT,
  invalidTypeError,
};
