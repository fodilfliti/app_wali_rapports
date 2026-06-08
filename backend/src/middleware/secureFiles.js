const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const { getEnv } = require("../config/env");
const { storageRoot } = require("../services/storage");
const { User } = require("../db");

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
      if (!user || user.is_blocked) return res.status(403).json({ error: "Forbidden" });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  });

  router.get("/*", (req, res) => {
    const rel = req.params[0] || "";
    if (rel.includes("..")) return res.status(400).json({ error: "Invalid path" });
    const abs = path.join(storageRoot(), rel);
    if (!abs.startsWith(storageRoot())) return res.status(400).json({ error: "Invalid path" });
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "Not found" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(abs);
  });

  return router;
}

module.exports = { secureFilesRouter };
