const { z } = require("zod");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FILE_STORAGE_ROOT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v === "true" || v === "1")),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional()
});

function getEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    const err = new Error(`Invalid environment: ${msg}`);
    err.status = 500;
    throw err;
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV || "development",
    port: e.PORT || 4001,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    fileStorageRoot: e.FILE_STORAGE_ROOT,
    corsOrigin: e.CORS_ORIGIN,
    logLevel: e.LOG_LEVEL || (e.NODE_ENV === "production" ? "info" : "debug"),
    trustProxy: e.TRUST_PROXY ?? e.NODE_ENV === "production",
    rateLimitWindowMs: e.RATE_LIMIT_WINDOW_MS || 60_000,
    rateLimitMax: e.RATE_LIMIT_MAX || 300
  };
}

module.exports = { getEnv };
