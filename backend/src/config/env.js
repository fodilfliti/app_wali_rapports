const { z } = require("zod");

const DurationSchema = z
  .string()
  .regex(/^\d+(ms|s|m|h|d)$/i, "must be like 15m or 7d")
  .optional();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: DurationSchema,
  REFRESH_TOKEN_EXPIRES_IN: DurationSchema,
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v === "true" || v === "1")),
  FILE_STORAGE_ROOT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v === "true" || v === "1")),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  API_BASE_PATH: z.string().optional(),
});

function normalizeApiBasePath(value) {
  if (!value || value === "/") return "";
  let path = value.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  return path.replace(/\/+$/, "");
}

function parseDurationMs(value, fallbackMs) {
  const m = String(value || "").trim().match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}

function getEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    const err = new Error(`Invalid environment: ${msg}`);
    err.status = 500;
    throw err;
  }
  const e = parsed.data;
  const nodeEnv = e.NODE_ENV || "development";
  return {
    nodeEnv,
    port: e.PORT || 4001,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    jwtAccessExpiresIn: e.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshTokenExpiresIn: e.REFRESH_TOKEN_EXPIRES_IN || "7d",
    refreshTokenExpiresMs: parseDurationMs(e.REFRESH_TOKEN_EXPIRES_IN || "7d", 7 * 86_400_000),
    cookieSecure: e.COOKIE_SECURE ?? nodeEnv === "production",
    fileStorageRoot: e.FILE_STORAGE_ROOT,
    corsOrigin: e.CORS_ORIGIN,
    logLevel: e.LOG_LEVEL || "info",
    trustProxy: e.TRUST_PROXY ?? e.NODE_ENV === "production",
    rateLimitWindowMs: e.RATE_LIMIT_WINDOW_MS || 60_000,
    rateLimitMax: e.RATE_LIMIT_MAX || 300,
    apiBasePath: normalizeApiBasePath(e.API_BASE_PATH),
  };
}

module.exports = { getEnv };
