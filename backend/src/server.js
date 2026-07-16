const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
// Local + server both use `.env` only. Do not merge `.env.production` here —
// that file is a template for deploying as `.env` and would force API_BASE_PATH=/api in dev.
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) require("dotenv").config({ path: envFile });

const { app } = require("./app");
const { getEnv } = require("./config/env");
const { getLogger } = require("./logger");
const { sequelize } = require("./db");

const env = getEnv();
const logger = getLogger();

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandled_rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught_exception");
  process.exit(1);
});

async function start() {
  try {
    await sequelize.authenticate();
    logger.info("database_connected");
  } catch (err) {
    // Passenger/cPanel often only surfaces stderr
    console.error(`[wali-api] database_connection_failed: ${err.message}`);
    logger.error({ err }, "database_connection_failed");
  }

  const onListen = () => {
    const passenger = typeof PhusionPassenger !== "undefined";
    console.error(`[wali-api] listening port=${env.port} passenger=${passenger}`);
    logger.info({ port: env.port, passenger }, "server_started");
  };

  if (typeof PhusionPassenger !== "undefined") {
    // cPanel / LiteSpeed Node.js (Passenger)
    // eslint-disable-next-line no-undef
    PhusionPassenger.configure({ autoInstall: false });
    app.listen("passenger", onListen);
  } else {
    app.listen(env.port, onListen);
  }
}

start().catch((err) => {
  console.error(`[wali-api] startup_failed: ${err.stack || err.message}`);
  logger.error({ err }, "startup_failed");
  process.exit(1);
});
