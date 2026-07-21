const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const { getEnv } = require("../config/env");
const { User, UploadedFile } = require("../db");
const {
  resolveSafeAbs,
  canAccessStoragePath,
  contentTypeForPath,
  isInlineMedia,
  ensureFileExists,
} = require("../services/fileAccessService");

function secureFilesRouter() {
  const router = express.Router();

  router.use(async (req, res, next) => {
    const header = req.headers.authorization || "";
    let token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token && req.query.access_token) token = String(req.query.access_token);
    if (!token) return res.status(401).json({ error: "Missing token" });
    try {
      const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ["HS256"] });
      const user = await User.findByPk(payload.sub);
      if (!user || user.is_blocked || user.deleted_at) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  });

  router.get("/*", async (req, res, next) => {
    try {
      const rel = req.params[0] || "";
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
