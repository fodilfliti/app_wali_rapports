const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const { z } = require("zod");
const { getEnv } = require("../config/env");
const { User, UploadedFile } = require("../db");
const { findByPublicId } = require("../modules/access/idResolver");
const {
  resolveSafeAbs,
  canAccessStoragePath,
  contentTypeForPath,
  isInlineMedia,
  ensureFileExists,
} = require("../services/fileAccessService");
const {
  normalizeStorageRelPath,
  signFileDownload,
  verifyFileDownloadToken,
  buildSignedFileUrl,
} = require("../services/fileDownloadSignService");

const SignSchema = z.object({ path: z.string().min(1) });
const SignBatchSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
});

async function loadUserFromAccessJwt(token) {
  const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ["HS256"] });
  if (payload.typ && payload.typ !== "access") return null;
  const user = await findByPublicId(User, payload.sub);
  if (!user || user.is_blocked || user.deleted_at) return null;
  return user;
}

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

/**
 * Rel path under /files mount.
 * Prefer req.path — `router.use()` auth runs before `/*`, so req.params[0] is empty there
 * (that caused 400 Invalid path on signed video/image downloads).
 */
function storageRelFromReq(req) {
  const fromParams =
    req.params && req.params[0] != null && String(req.params[0]) !== ""
      ? String(req.params[0])
      : "";
  let p = fromParams || String(req.path || "");
  if (p.startsWith("/")) p = p.slice(1);
  return p;
}

async function authenticateAccessBearer(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const user = await loadUserFromAccessJwt(token);
    if (!user) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function authenticateFileRequest(req, res, next) {
  const bearer = readBearerToken(req);
  if (bearer) {
    try {
      const user = await loadUserFromAccessJwt(bearer);
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      /* fall through to dl token */
    }
  }

  const dl = req.query.dl ? String(req.query.dl) : null;
  if (!dl) return res.status(401).json({ error: "Missing token" });

  try {
    const rel = storageRelFromReq(req);
    const resolved = resolveSafeAbs(rel);
    if (!resolved) return res.status(400).json({ error: "Invalid path" });
    const userId = verifyFileDownloadToken(dl, resolved.normalized);
    const user = await User.findByPk(userId);
    if (!user || user.is_blocked || user.deleted_at) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function secureFilesRouter() {
  const router = express.Router();

  router.post("/sign", authenticateAccessBearer, async (req, res, next) => {
    try {
      const { path: clientPath } = SignSchema.parse(req.body);
      const rel = normalizeStorageRelPath(clientPath);
      if (!rel) return res.status(400).json({ error: "Invalid path" });
      const resolved = resolveSafeAbs(rel);
      if (!resolved) return res.status(400).json({ error: "Invalid path" });
      const allowed = await canAccessStoragePath(req.user, resolved.normalized);
      if (!allowed) return res.status(404).json({ error: "Not found" });
      const dl = signFileDownload(req.user.id, resolved.normalized);
      res.json({ url: buildSignedFileUrl(resolved.normalized, dl) });
    } catch (e) {
      next(e);
    }
  });

  router.post("/sign-batch", authenticateAccessBearer, async (req, res, next) => {
    try {
      const { paths } = SignBatchSchema.parse(req.body);
      const urls = {};
      for (const clientPath of paths) {
        const rel = normalizeStorageRelPath(clientPath);
        if (!rel) continue;
        const resolved = resolveSafeAbs(rel);
        if (!resolved) continue;
        const allowed = await canAccessStoragePath(req.user, resolved.normalized);
        if (!allowed) continue;
        const dl = signFileDownload(req.user.id, resolved.normalized);
        const signed = buildSignedFileUrl(resolved.normalized, dl);
        const clean = String(clientPath).replace(/\?.*$/, "").replace(/#.*$/, "");
        urls[clean] = signed;
        urls[`/files/${resolved.normalized}`] = signed;
      }
      res.json({ urls });
    } catch (e) {
      next(e);
    }
  });

  router.use(authenticateFileRequest);

  router.get("/*", async (req, res, next) => {
    try {
      const rel = storageRelFromReq(req);
      const resolved = resolveSafeAbs(rel);
      if (!resolved) return res.status(400).json({ error: "Invalid path" });
      const { abs, normalized } = resolved;

      const allowed = await canAccessStoragePath(req.user, normalized);
      if (!allowed) return res.status(404).json({ error: "Not found" });

      if (!ensureFileExists(abs)) return res.status(404).json({ error: "Not found" });

      let mimeFromDb = null;
      if (normalized.startsWith("uploads/")) {
        const row = await UploadedFile.findOne({
          where: { storage_rel_path: normalized },
          attributes: ["mime_type"],
        });
        mimeFromDb = row?.mime_type || null;
      }

      const contentType = contentTypeForPath(normalized, mimeFromDb);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", contentType);
      res.setHeader("X-Frame-Options", "DENY");
      if (!isInlineMedia(contentType)) {
        const name = path.posix.basename(normalized);
        res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
      }

      res.sendFile(abs);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

module.exports = { secureFilesRouter };
