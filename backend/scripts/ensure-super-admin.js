"use strict";

/**
 * Ensure super-admin from env. Usage:
 *   node scripts/ensure-super-admin.js
 * Uses SUPER_ADMIN_* if set, else DEV_ADMIN_*.
 * Optional: SUPER_ADMIN_RESET_PASSWORD=YES to refresh password from env.
 */
require("./load-env");
const { sequelize } = require("../src/db");
const { ensureSuperAdminFromEnv } = require("./lib/ensureSuperAdmin");

async function main() {
  await sequelize.authenticate();
  const resetPassword = process.env.SUPER_ADMIN_RESET_PASSWORD === "YES";
  const result = await ensureSuperAdminFromEnv({ resetPassword });
  console.log(result);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
