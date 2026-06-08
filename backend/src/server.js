require("dotenv").config();
const { app } = require("./app");
const { getEnv } = require("./config/env");
const { getLogger } = require("./logger");
const { sequelize } = require("./db");

const env = getEnv();
const logger = getLogger();

async function start() {
  await sequelize.authenticate();
  logger.info("database_connected");
  app.listen(env.port, () => {
    logger.info({ port: env.port }, "server_started");
  });
}

start().catch((err) => {
  logger.error({ err }, "startup_failed");
  process.exit(1);
});
