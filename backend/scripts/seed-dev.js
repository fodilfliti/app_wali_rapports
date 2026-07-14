"use strict";

require("./load-env");

const bcrypt = require("bcryptjs");
const tlemcenMunicipalities = require("../src/db/seed-data/tlemcen-municipalities");
const { sequelize, Municipality, User, AccessRoleTemplate } = require("../src/db");

function devAdminConfig() {
  return {
    username: process.env.DEV_ADMIN_USERNAME || "admin",
    email: process.env.DEV_ADMIN_EMAIL || "admin@tlemcen.local",
    password: process.env.DEV_ADMIN_PASSWORD || "Admin123!",
    name: process.env.DEV_ADMIN_NAME || "Administrateur Wilaya"
  };
}

async function seedMunicipalities() {
  const existing = await Municipality.count();
  if (existing > 0) {
    console.log(`Municipalities already present (${existing}) — skipping insert.`);
    return existing;
  }
  const now = new Date();
  await Municipality.bulkCreate(
    tlemcenMunicipalities.map((m) => ({ ...m, created_at: now }))
  );
  console.log(`Inserted ${tlemcenMunicipalities.length} Tlemcen municipalities.`);
  return tlemcenMunicipalities.length;
}

async function seedAdmin() {
  const cfg = devAdminConfig();
  const template = await AccessRoleTemplate.findOne({ where: { slug: "ADMIN_FULL" } });
  if (!template) {
    throw new Error("ADMIN_FULL role template missing — run migrations first (npm run db:migrate).");
  }

  const passwordHash = bcrypt.hashSync(cfg.password, 10);
  let user = await User.scope("withPassword").findOne({ where: { username: cfg.username } });

  if (user) {
    await user.update({
      name: cfg.name,
      email: cfg.email,
      password_hash: passwordHash,
      role: "ADMIN",
      access_role_template_id: template.id,
      is_blocked: false,
      use_custom_permissions: false
    });
    console.log(`Updated dev admin user "${cfg.username}".`);
  } else {
    user = await User.create({
      username: cfg.username,
      name: cfg.name,
      email: cfg.email,
      password_hash: passwordHash,
      role: "ADMIN",
      access_role_template_id: template.id,
      is_blocked: false,
      use_custom_permissions: false,
      email_hidden: false
    });
    console.log(`Created dev admin user "${cfg.username}".`);
  }

  return user;
}

async function main() {
  try {
    await sequelize.authenticate();
    await seedMunicipalities();
    await seedAdmin();
    const cfg = devAdminConfig();
    console.log("\nDev login (also saved in backend/.env):");
    console.log(`  username: ${cfg.username}`);
    console.log(`  email:    ${cfg.email}`);
    console.log(`  password: ${cfg.password}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
