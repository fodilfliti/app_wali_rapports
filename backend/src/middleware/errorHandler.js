const { getLogger } = require("../logger");

function errorHandler(err, req, res, next) {
  const logger = req.log || getLogger();
  const status = Number(err?.status || 500);
  const message = status >= 500 ? "Internal Server Error" : String(err?.message || "Request failed");
  const method = req.method;
  const path = req.originalUrl || req.url;
  const requestId = req.requestId;

  if (status >= 500) {
    logger.error(
      { err, requestId, method, path, status, userId: req.user?.id },
      `ERROR ${method} ${path} → ${status}`,
    );
  } else {
    logger.warn(
      {
        requestId,
        method,
        path,
        status,
        userId: req.user?.id,
        reason: String(err?.message || "Request failed"),
      },
      `WARN  ${method} ${path} → ${status}`,
    );
  }

  const payload = { error: message, requestId };
  try {
    const { getEnv } = require("../config/env");
    if (getEnv().nodeEnv !== "production" && err?.message) payload.detail = String(err.message);
  } catch {
    /* ignore */
  }
  res.status(status).json(payload);
}

module.exports = { errorHandler };
