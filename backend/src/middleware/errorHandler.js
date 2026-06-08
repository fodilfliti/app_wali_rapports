const { getLogger } = require("../logger");

function errorHandler(err, req, res, next) {
  const logger = getLogger();
  const status = Number(err?.status || 500);
  const message = status >= 500 ? "Internal Server Error" : String(err?.message || "Request failed");
  logger.error({ err, requestId: req.requestId, method: req.method, path: req.originalUrl }, "request_failed");
  const payload = { error: message, requestId: req.requestId };
  try {
    const { getEnv } = require("../config/env");
    if (getEnv().nodeEnv !== "production" && err?.message) payload.detail = String(err.message);
  } catch {
    /* ignore */
  }
  res.status(status).json(payload);
}

module.exports = { errorHandler };
