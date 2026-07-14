const path = require("path");
const fs = require("fs");
const { Sequelize } = require("sequelize");
const { parse } = require("pg-connection-string");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
}
const databaseUrl = process.env.DATABASE_URL;
const hasDiscretePg =
  process.env.PGUSER && process.env.PGDATABASE;
if (!databaseUrl && !hasDiscretePg) {
  throw new Error(
    "DATABASE_URL is not set (or set PGUSER + PGDATABASE). Create backend/.env from .env.example."
  );
}

const common = {
  dialect: "postgres",
  logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false
};

function dialectOptions() {
  return process.env.PGSSLMODE === "require"
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};
}

function credentialsFromEnv() {
  if (!hasDiscretePg) return null;
  return {
    database: process.env.PGDATABASE,
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined
  };
}

function credentialsFromUrl() {
  const parsed = parse(databaseUrl);
  return {
    database: parsed.database,
    username: parsed.user,
    password: process.env.PGPASSWORD || parsed.password || undefined
  };
}

/** cPanel/DZSecurity: socket (/var/run/postgresql) or TCP (PGHOST=127.0.0.1) */
function buildConfig() {
  const creds = credentialsFromEnv() || credentialsFromUrl();
  const base = {
    ...common,
    ...creds,
    dialectOptions: dialectOptions()
  };

  const socketDir = process.env.PGSOCKETDIR;
  if (socketDir) {
    return { ...base, host: socketDir };
  }

  const tcpHost = process.env.PGHOST;
  if (tcpHost) {
    return {
      ...base,
      host: tcpHost,
      port: Number(process.env.PGPORT || 5432)
    };
  }

  if (hasDiscretePg) {
    return { ...base, host: "127.0.0.1", port: Number(process.env.PGPORT || 5432) };
  }

  return { ...common, url: databaseUrl, dialectOptions: dialectOptions() };
}

function createSequelize(config) {
  if (!config) throw new Error("Database config is missing.");
  if (config.url) return new Sequelize(config.url, config);
  const { database, username, password, dialect, ...rest } = config;
  if (!database || !username) {
    throw new Error("DATABASE_URL or PGUSER/PGDATABASE is required.");
  }
  return new Sequelize(database, username, password ?? null, { dialect, ...rest });
}

module.exports = {
  development: { ...common, url: databaseUrl },
  test: { ...common, url: databaseUrl },
  production: buildConfig(),
  createSequelize
};
