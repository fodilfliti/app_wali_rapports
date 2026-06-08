const pino = require("pino");
const { getEnv } = require("./config/env");

let logger;

function getLogger() {
  if (!logger) {
    const env = getEnv();
    logger = pino({
      level: env.logLevel,
      transport:
        env.nodeEnv !== "production"
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
          : undefined
    });
  }
  return logger;
}

module.exports = { getLogger };
