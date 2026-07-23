"use strict";

require("./load-env");

const bcrypt = require("bcryptjs");
const tlemcenDairas = require("../src/db/seed-data/tlemcen-dairas");
const tlemcenMunicipalities = require("../src/db/seed-data/tlemcen-municipalities");
const { sequelize, Daira, Municipality, User, AccessRoleTemplate } = require("../src/db");
const { withUuid } = require("./lib/seedIdentity");

function devAdminConfig() {
  return {
    username: process.env.DEV_ADMIN_USERNAME || "admin",
    email: process.env.DEV_ADMIN_EMAIL || "admin@tlemcen.local",
    password: process.env.DEV_ADMIN_PASSWORD || "Admin123!",
    name: process.env.DEV_ADMIN_NAME || "Administrateur Wilaya"
  };
}

async function seedDairas() {
  const existing = await Daira.count();
  if (existing > 0) {
    console.log(`Dairas already present (${existing}) — skipping insert.`);
    return existing;
  }
  const now = new Date();
  await Daira.bulkCreate(
    tlemcenDairas.map((d) => withUuid({ ...d, created_at: now })),
  );
  console.log(`Inserted ${tlemcenDairas.length} Tlemcen dairas.`);
  return tlemcenDairas.length;
}

async function seedMunicipalities() {
  const existing = await Municipality.count();
  if (existing > 0) {
    const missing = await Municipality.count({ where: { daira_id: null } }).catch(() => 0);
    if (missing === 0) {
      console.log(`Municipalities already present (${existing}) — skipping insert.`);
      return existing;
    }
  }
  const dairas = await Daira.findAll();
  const dairaByCode = Object.fromEntries(dairas.map((d) => [d.code, d.id]));
  const now = new Date();
  if (existing === 0) {
    await Municipality.bulkCreate(
      tlemcenMunicipalities.map((m) =>
        withUuid({
          code: m.code,
          name_ar: m.name_ar,
          name_fr: m.name_fr,
          daira_id: dairaByCode[m.daira_code] || dairaByCode["1301"],
          created_at: now,
        }),
      ),
    );
    console.log(`Inserted ${tlemcenMunicipalities.length} Tlemcen municipalities.`);
  } else {
    for (const m of tlemcenMunicipalities) {
      await Municipality.update(
        { daira_id: dairaByCode[m.daira_code] || dairaByCode["1301"] },
        { where: { code: m.code, daira_id: null } }
      );
    }
    console.log("Linked existing municipalities to dairas.");
  }
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
    await seedDairas();
    await seedMunicipalities();
    await seedAdmin();
    const { ensureSuperAdminFromEnv } = require("./lib/ensureSuperAdmin");
    const superResult = await ensureSuperAdminFromEnv({ resetPassword: true });
    if (superResult.skipped) {
      console.log("Super-admin skipped (SUPER_ADMIN_* / DEV_ADMIN_* not set).");
    } else if (superResult.created) {
      console.log(`Created super-admin "${superResult.username}".`);
    } else {
      console.log(`Updated super-admin "${superResult.username}".`);
    }
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
