const { levelRank } = require("../modules/access/permissionCatalog");

function requirePermission(permissionKey, minLevel = "view") {
  return (req, res, next) => {
    const map = req.effectivePermissions || {};
    const level = map[permissionKey] || "none";
    if (levelRank(level) >= levelRank(minLevel)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

module.exports = { requirePermission };
