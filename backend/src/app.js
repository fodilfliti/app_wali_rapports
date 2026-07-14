const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const { secureFilesRouter } = require("./middleware/secureFiles");
const { ensureStorageDirs } = require("./services/storage");
const { authRouter } = require("./routes/auth");
const { adminRouter } = require("./routes/admin");
const { officeRouter } = require("./routes/office");
const { waliRouter } = require("./routes/wali");
const { requestContext } = require("./middleware/requestContext");
const { errorHandler } = require("./middleware/errorHandler");
const { getEnv } = require("./config/env");
const { getLogger } = require("./logger");

const app = express();
const env = getEnv();
const logger = getLogger();
const apiBase = env.apiBasePath || "";

app.set("trust proxy", Boolean(env.trustProxy));
app.use(requestContext);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    autoLogging: {
      ignore: (req) => {
        const p = req.path || req.url || "";
        return p === "/health" || p.endsWith("/health") || p.includes("/files/");
      },
    },
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const corsOrigin = env.corsOrigin
  ? env.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function isDevLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.nodeEnv !== "production" && isDevLocalOrigin(origin)) return callback(null, true);
      if (corsOrigin?.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: Boolean(corsOrigin && corsOrigin.length),
    exposedHeaders: ["Content-Disposition"]
  })
);

app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json({ limit: "2mb" }));

try {
  ensureStorageDirs();
} catch (err) {
  console.error("[wali-api] storage_init_failed:", err.message);
}

const api = express.Router();
api.get("/health", (req, res) => res.json({ ok: true }));
api.use("/files", secureFilesRouter());
api.use("/auth", authRouter);
api.use("/admin", adminRouter);
api.use("/office", officeRouter);
api.use("/wali", waliRouter);

app.use(apiBase, api);
app.use(errorHandler);

module.exports = { app };
