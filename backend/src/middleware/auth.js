const jwt = require("jsonwebtoken");
const { User, Department } = require("../db");
const { getEnv } = require("../config/env");
const { resolveEffectivePermissions } = require("../modules/access/userAccessService");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ["HS256"] });
    if (payload.typ && payload.typ !== "access") {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function attachUser(req, res, next) {
  if (!req.auth?.sub) return res.status(401).json({ error: "Invalid token payload" });
  const user = await User.findByPk(req.auth.sub, {
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }
    ]
  });
  if (!user) return res.status(401).json({ error: "User not found" });
  req.user = user;
  req.effectivePermissions = await resolveEffectivePermissions(user);
  next();
}

function requireRole(roles) {
  const allow = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(500).json({ error: "User not loaded" });
    if (!allow.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function checkBlocked(req, res, next) {
  if (!req.user) return res.status(500).json({ error: "User not loaded" });
  if (req.user.is_blocked) return res.status(403).json({ error: "Blocked" });
  next();
}

module.exports = { requireAuth, attachUser, requireRole, checkBlocked };
