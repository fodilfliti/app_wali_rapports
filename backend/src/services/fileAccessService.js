const path = require("path");
const fs = require("fs");
const {
  UploadedFile,
  GuideVideo,
  WaliBroadcast,
  WaliBroadcastRecipient,
  WaliInstructionFile,
  WaliInstructionRecipient,
} = require("../db");
const { assertRapportAccess } = require("../modules/rapports/serviceAccessService");
const { storageRoot } = require("./storage");

const PUBLIC_GUIDE_AUDIENCES = ["general", "OFFICE_USER", "CHEF_CABINET", "WALI"];

function normalizeRel(rel) {
  return String(rel || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function resolveSafeAbs(rel) {
  const normalized = normalizeRel(rel);
  if (!normalized || normalized.includes("\0")) return null;
  if (normalized.split("/").some((p) => p === ".." || p === "")) return null;
  const root = storageRoot();
  const abs = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) return null;
  return { abs, normalized };
}

/**
 * Whether `user` may download the storage-relative path.
 */
async function canAccessStoragePath(user, relPath) {
  if (!user || user.is_blocked || user.deleted_at) return false;
  const resolved = resolveSafeAbs(relPath);
  if (!resolved) return false;
  const { normalized } = resolved;

  // Never serve bootstrap / private credential sheets via HTTP.
  if (normalized === "bootstrap" || normalized.startsWith("bootstrap/")) return false;

  // Credential PDFs: admin only.
  const base = path.posix.basename(normalized);
  if (normalized.startsWith("pdf/") && /^credentials_/i.test(base)) {
    return user.role === "ADMIN";
  }

  if (normalized.startsWith("uploads/")) {
    const file = await UploadedFile.findOne({ where: { storage_rel_path: normalized } });
    if (!file) return user.role === "ADMIN";
    return canAccessUploadedFile(user, file);
  }

  // Other pdf / exports: admin only (generated artefacts).
  if (normalized.startsWith("pdf/") || normalized.startsWith("exports/")) {
    return user.role === "ADMIN";
  }

  return false;
}

async function canAccessUploadedFile(user, file) {
  if (user.role === "ADMIN") return true;
  if (Number(file.uploaded_by_user_id) === Number(user.id)) return true;

  if (file.rapport_id) {
    try {
      await assertRapportAccess(user, file.rapport_id, "view");
      return true;
    } catch {
      /* fall through */
    }
    // Chef / Wali may view files on rapports in their inbox without office grants.
    if (user.role === "WALI" || user.role === "CHEF_CABINET") {
      try {
        const rapportService = require("../modules/rapports/rapportService");
        if (user.role === "WALI") await rapportService.assertVisibleToWali(file.rapport_id);
        else await rapportService.assertVisibleToChef(file.rapport_id);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Guide videos
  const guide = await GuideVideo.findOne({
    where: { uploaded_file_id: file.id },
    attributes: ["id", "audience"],
  });
  if (guide) {
    if (user.role === "ADMIN") return true;
    if (PUBLIC_GUIDE_AUDIENCES.includes(guide.audience)) {
      if (guide.audience === "general") return true;
      return guide.audience === user.role;
    }
    return false;
  }

  // Broadcasts
  const broadcast = await WaliBroadcast.findOne({
    where: { uploaded_file_id: file.id },
    attributes: ["id"],
  });
  if (broadcast) {
    if (user.role === "WALI" || user.role === "ADMIN") return true;
    const hit = await WaliBroadcastRecipient.findOne({
      where: { broadcast_id: broadcast.id, user_id: user.id },
      attributes: ["id"],
    });
    return Boolean(hit);
  }

  // Instruction attachments
  const link = await WaliInstructionFile.findOne({
    where: { uploaded_file_id: file.id },
    attributes: ["instruction_id"],
  });
  if (link) {
    if (user.role === "WALI" || user.role === "ADMIN") return true;
    if (user.role === "CHEF_CABINET") return true; // Chef read-only instructions
    const rec = await WaliInstructionRecipient.findOne({
      where: { instruction_id: link.instruction_id, user_id: user.id },
      attributes: ["id"],
    });
    return Boolean(rec);
  }

  return false;
}

function contentTypeForPath(relPath, mimeFromDb) {
  const ext = path.extname(relPath).toLowerCase();
  const byExt = {
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
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
  };
  if (byExt[ext]) return byExt[ext];
  if (mimeFromDb && !/^text\/html|^image\/svg|^application\/javascript|^text\/javascript/i.test(mimeFromDb)) {
    return mimeFromDb;
  }
  return "application/octet-stream";
}

function isInlineMedia(contentType) {
  return /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|application\/pdf)$/i.test(
    contentType,
  );
}

function ensureFileExists(abs) {
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

module.exports = {
  normalizeRel,
  resolveSafeAbs,
  canAccessStoragePath,
  contentTypeForPath,
  isInlineMedia,
  ensureFileExists,
};
