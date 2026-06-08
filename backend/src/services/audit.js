const { AuditLog } = require("../db");

function getReqMeta(req) {
  if (!req) return {};
  const ip =
    (req.headers?.["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) ||
    req.socket?.remoteAddress ||
    null;
  return {
    request_id: req.requestId || null,
    ip,
    user_agent: req.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 512) : null
  };
}

async function audit(actorId, actionType, details, opts) {
  const meta = getReqMeta(opts?.req);
  const mergedDetails = { ...(details ?? null), ...(meta.request_id || meta.ip || meta.user_agent ? { __meta: meta } : {}) };
  await AuditLog.create(
    { actor_id: actorId || null, action_type: actionType, details: mergedDetails ?? null },
    opts?.transaction ? { transaction: opts.transaction } : undefined
  );
}

module.exports = { audit };
