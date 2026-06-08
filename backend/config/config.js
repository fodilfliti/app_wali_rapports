const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Create backend/.env from .env.example.");
}

const common = {
  dialect: "postgres",
  logging: process.env.SEQUELIZE_LOGGING === "true" ? console.log : false
};

module.exports = {
  development: { ...common, url: databaseUrl },
  test: { ...common, url: databaseUrl },
  production: {
    ...common,
    url: databaseUrl,
    dialectOptions: process.env.PGSSLMODE === "require" ? { ssl: { require: true, rejectUnauthorized: false } } : {}
  }
};
