const pino = require("pino");
const { getEnv } = require("./config/env");

let logger;

function getLogger() {
  if (!logger) {
    const env = getEnv();
    const isProd = env.nodeEnv === "production";
    logger = pino({
      level: env.logLevel,
      base: { service: "wali-api", env: env.nodeEnv },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "password",
          "password_hash",
          "*.password",
          "*.password_hash",
        ],
        remove: true,
      },
      transport: !isProd
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              singleLine: true,
              ignore: "pid,hostname,service,env",
              messageFormat: "{msg}",
            },
          }
        : undefined,
    });
  }
  return logger;
}

module.exports = { getLogger };
