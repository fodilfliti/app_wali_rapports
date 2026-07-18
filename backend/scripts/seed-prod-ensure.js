"use strict";

/**
 * Production ensure: add missing cabinet users + root leaf services + grants.
 * Never deletes. Never resets existing passwords.
 * Flat root leaves only (no nested demo folders — those are DEV seed-demo-cabinet only).
 *
 * Usage:
 *   CONFIRM_PROD_ENSURE=YES npm run db:seed-prod-ensure
 *
 * After editing prodBootstrapInventory.js (new people / services), re-run on prod.
 * Writes only NEW credentials to storage/bootstrap/credentials-added-<timestamp>.xlsx
 */

require("./load-env");

const path = require("path");

const {
  sequelize,
  Department,
  User,
  Service,
  UserServiceGrant,
} = require("../src/db");

const inventory = require("./data/prodBootstrapInventory");
const {
  DEPT_NAME_AR,
  DEPT_NAME_FR,
  generatePassword,
  createUser,
  writeCredentialsSheet,
  bootstrapOutDir,
  credentialRow,
} = require("./lib/prodCabinetUsers");

function assertConfirm() {
  if (process.env.CONFIRM_PROD_ENSURE !== "YES") {
    console.error(`
Refusing to run. This script only ADDS missing users/services/grants (no wipe).

Set CONFIRM_PROD_ENSURE=YES and run again:
  CONFIRM_PROD_ENSURE=YES npm run db:seed-prod-ensure
`);
    process.exit(1);
  }
}

async function findOrCreateDepartment() {
  let dept = await Department.findOne({ where: { name_ar: DEPT_NAME_AR } });
  if (dept) return { dept, created: false };
  dept = await Department.create({
    name_ar: DEPT_NAME_AR,
    name_fr: DEPT_NAME_FR,
    sort_order: 0,
    is_active: true,
  });
  return { dept, created: true };
}

async function nextServiceSortOrder() {
  const max = await Service.max("sort_order");
  return (max == null ? -1 : Number(max)) + 1;
}

async function ensureUser({ username, name, role, job_title, templateSlug }, stats, newCreds) {
  const existing = await User.findOne({ where: { username } });
  if (existing) {
    console.log(`  User exists (skip): ${username}`);
    stats.usersSkipped += 1;
    return existing;
  }
  const password = generatePassword();
  const user = await createUser({
    username,
    name,
    role,
    job_title,
    templateSlug,
    password,
  });
  newCreds.push(credentialRow({ username, name, password, job_title, role }));
  console.log(`  User created: ${username}`);
  stats.usersCreated += 1;
  return user;
}

async function ensureLeafService(dept, svc, sortOrderRef, stats) {
  let leaf = await Service.findOne({ where: { slug: svc.slug } });
  if (leaf) {
    stats.servicesSkipped += 1;
    return leaf;
  }
  leaf = await Service.create({
    department_id: dept.id,
    slug: svc.slug,
    name_ar: svc.name_ar,
    name_fr: svc.name_fr,
    sort_order: sortOrderRef.value,
    is_active: true,
    is_folder: false,
    parent_service_id: null,
  });
  sortOrderRef.value += 1;
  console.log(`    Service created: ${svc.slug} (${svc.name_ar})`);
  stats.servicesCreated += 1;
  return leaf;
}

async function ensureManageGrant(userId, serviceId, stats) {
  const existing = await UserServiceGrant.findOne({
    where: { user_id: userId, service_id: serviceId },
  });
  if (existing) {
    if (existing.access_level !== "manage") {
      await existing.update({ access_level: "manage" });
      stats.grantsUpdated += 1;
    } else {
      stats.grantsSkipped += 1;
    }
    return;
  }
  await UserServiceGrant.create({
    user_id: userId,
    service_id: serviceId,
    access_level: "manage",
  });
  stats.grantsCreated += 1;
}

async function main() {
  assertConfirm();
  await sequelize.authenticate();

  const stats = {
    usersCreated: 0,
    usersSkipped: 0,
    servicesCreated: 0,
    servicesSkipped: 0,
    grantsCreated: 0,
    grantsSkipped: 0,
    grantsUpdated: 0,
  };
  const newCreds = [];

  const { dept, created: deptCreated } = await findOrCreateDepartment();
  console.log(
    deptCreated ? `Department created: ${DEPT_NAME_AR}` : `Department exists: ${DEPT_NAME_AR}`,
  );

  const sortOrderRef = { value: await nextServiceSortOrder() };

  for (const officer of inventory.officeUsers) {
    console.log(`Office: ${officer.username}`);
    const user = await ensureUser(
      {
        username: officer.username,
        name: officer.name,
        role: "OFFICE_USER",
        job_title: officer.job_title,
        templateSlug: "OFFICE_STANDARD",
      },
      stats,
      newCreds,
    );

    for (const svc of officer.services) {
      const leaf = await ensureLeafService(dept, svc, sortOrderRef, stats);
      await ensureManageGrant(user.id, leaf.id, stats);
    }
  }

  for (const rev of inventory.reviewUsers) {
    console.log(`Review: ${rev.username}`);
    await ensureUser(
      {
        username: rev.username,
        name: rev.name,
        role: rev.role,
        job_title: rev.job_title,
        templateSlug: rev.templateSlug,
      },
      stats,
      newCreds,
    );
  }

  const outDir = bootstrapOutDir();
  let addedPath = null;
  if (newCreds.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    addedPath = path.join(outDir, `credentials-added-${stamp}.xlsx`);
    await writeCredentialsSheet(addedPath, newCreds);
  }

  console.log("\nEnsure complete (no wipe).");
  console.log(`  Users: +${stats.usersCreated} created, ${stats.usersSkipped} skipped`);
  console.log(
    `  Services: +${stats.servicesCreated} created, ${stats.servicesSkipped} skipped`,
  );
  console.log(
    `  Grants: +${stats.grantsCreated} created, ${stats.grantsSkipped} skipped, ${stats.grantsUpdated} upgraded to manage`,
  );
  if (addedPath) {
    console.log(`  New credentials only: ${addedPath}`);
  } else {
    console.log("  No new users — no credentials file written.");
  }

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
