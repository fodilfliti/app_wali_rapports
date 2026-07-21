"use strict";

/**
 * Production bootstrap: wipe user-domain activity, recreate cabinet users + root leaf services.
 *
 * Usage (once, after backup) — cPanel-friendly, no env prefix needed:
 *   npm run db:seed-prod-bootstrap
 *
 * Keeps: ADMIN users, dairas/communes/directions, access role templates,
 *        guide videos (+ their uploaded files), fiche_lecture rapport types
 *        (instances/rapports still wiped; types recreated on each leaf service).
 * Wipes: non-admin users, services/departments, rapports (incl. fiche docs), other types/schemas,
 *        notifications, instructions/broadcasts, tokens — then recreates cabinet from inventory.
 * Each new leaf service gets a fiche_lecture type (same as admin UI).
 * Writes Excel credentials + printable PDF under backend/private/bootstrap/ (gitignored).
 *
 * For later additions without wipe, use: npm run db:seed-prod-ensure
 */

require("./load-env");

const path = require("path");

const {
  sequelize,
  Department,
  Service,
  UserServiceGrant,
} = require("../src/db");

const inventory = require("./data/prodBootstrapInventory");
const {
  DEPT_NAME_AR,
  DEPT_NAME_FR,
  generatePassword,
  createUser,
  ensureFicheLectureType,
  writeCredentialsSheet,
  bootstrapOutDir,
  credentialRow,
} = require("./lib/prodCabinetUsers");
const { writeCredentialsHandoutPdf } = require("../src/services/credentialsPdfService");

function assertConfirm() {
  const confirmed =
    process.env.CONFIRM_PROD_BOOTSTRAP === "YES" || process.argv.includes("--confirm");
  if (!confirmed) {
    console.error(`
Refusing to run. This script WIPES office/wali/chef data (rapports, non-fiche types, users…) but keeps guide videos + ADMIN; recreates fiche_lecture per leaf.

Run via npm (passes --confirm):
  npm run db:seed-prod-bootstrap
`);
    process.exit(1);
  }
}

async function clearDomain() {
  console.log("Wiping office/wali/chef data (keeping ADMIN, guide videos, org reference)...");

  await sequelize.query("UPDATE rapports SET current_version_id = NULL");

  // Everything office / wali / chef create or use — keep guide_videos (admin).
  const tables = [
    "notifications",
    "web_push_subscriptions",
    "user_notification_preferences",
    "wali_broadcast_comments",
    "wali_broadcast_recipients",
    "wali_broadcasts",
    "wali_instruction_recipients",
    "wali_instruction_files",
    "wali_instructions",
    "rapport_comments",
    "chef_responses",
    "rapport_views",
    "rapport_calendar_events",
    "wali_responses",
    "rapport_versions",
    "rapports",
    "user_service_grants",
    "rapport_document_templates",
    "rapport_table_schemas",
    "refresh_tokens",
    "user_permission_overrides",
    "audit_logs",
  ];

  for (const table of tables) {
    try {
      await sequelize.query(`DELETE FROM ${table}`);
    } catch (err) {
      if (String(err.message || "").includes("does not exist")) continue;
      throw err;
    }
  }

  // Keep fiche_lecture types on services; wipe other rapport types (office-created schemas).
  // (Services wipe below still cascades remaining fiche types — recreated per leaf after.)
  try {
    await sequelize.query(`DELETE FROM rapport_types WHERE content_kind <> 'fiche_lecture'`);
  } catch (err) {
    if (!String(err.message || "").includes("does not exist")) throw err;
  }

  // Keep uploaded_files used by guide videos; drop the rest (rapport media, etc.).
  try {
    await sequelize.query(`
      DELETE FROM uploaded_files
      WHERE id NOT IN (
        SELECT uploaded_file_id FROM guide_videos
      )
    `);
  } catch (err) {
    if (!String(err.message || "").includes("does not exist")) throw err;
  }

  // guide_videos.created_by_user_id ON DELETE CASCADE — reassign to an ADMIN before user wipe.
  const [admins] = await sequelize.query(
    `SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id ASC LIMIT 1`,
  );
  const adminId = admins?.[0]?.id;
  if (adminId) {
    await sequelize.query(`UPDATE guide_videos SET created_by_user_id = :adminId`, {
      replacements: { adminId },
    });
  } else {
    console.warn("  No ADMIN user found — guide videos may be removed when non-admin users are deleted.");
  }

  await sequelize.query("UPDATE users SET department_id = NULL");
  await sequelize.query("UPDATE services SET parent_service_id = NULL");
  await sequelize.query("DELETE FROM services");
  await sequelize.query("DELETE FROM departments");

  const [deletedUsers] = await sequelize.query(
    `DELETE FROM users WHERE role <> 'ADMIN' RETURNING username`,
  );
  const removed = (deletedUsers || []).map((r) => r.username).filter(Boolean);
  if (removed.length) {
    console.log(`  Removed non-admin users: ${removed.join(", ")}`);
  }

  console.log("Wipe done (guide videos kept; fiche types recreated with services).");
}

async function main() {
  assertConfirm();
  await sequelize.authenticate();

  await clearDomain();

  const dept = await Department.create({
    name_ar: DEPT_NAME_AR,
    name_fr: DEPT_NAME_FR,
    sort_order: 0,
    is_active: true,
  });

  const officeCreds = [];
  const reviewCreds = [];
  let sortSvc = 0;

  for (const officer of inventory.officeUsers) {
    const password = generatePassword();
    const user = await createUser({
      username: officer.username,
      name: officer.name,
      role: "OFFICE_USER",
      job_title: officer.job_title,
      templateSlug: "OFFICE_STANDARD",
      password,
    });
    officeCreds.push(
      credentialRow({
        username: officer.username,
        name: officer.name,
        password,
        job_title: officer.job_title,
        role: "OFFICE_USER",
      }),
    );

    for (const svc of officer.services) {
      const leaf = await Service.create({
        department_id: dept.id,
        slug: svc.slug,
        name_ar: svc.name_ar,
        name_fr: svc.name_fr,
        sort_order: sortSvc++,
        is_active: true,
        is_folder: false,
        parent_service_id: null,
      });
      await ensureFicheLectureType(leaf);
      await UserServiceGrant.create({
        user_id: user.id,
        service_id: leaf.id,
        access_level: "manage",
      });
    }

    console.log(`  Office ${officer.username}: ${officer.services.length} root services`);
  }

  for (const rev of inventory.reviewUsers) {
    const password = generatePassword();
    await createUser({
      username: rev.username,
      name: rev.name,
      role: rev.role,
      job_title: rev.job_title,
      templateSlug: rev.templateSlug,
      password,
    });
    reviewCreds.push(
      credentialRow({
        username: rev.username,
        name: rev.name,
        password,
        job_title: rev.job_title,
        role: rev.role,
      }),
    );
    console.log(`  Review account: ${rev.username}`);
  }

  const outDir = bootstrapOutDir();
  const officePath = path.join(outDir, "credentials-office.xlsx");
  const reviewPath = path.join(outDir, "credentials-chef-wali.xlsx");
  const handoutPath = path.join(outDir, "credentials-handout.pdf");
  await writeCredentialsSheet(officePath, officeCreds);
  await writeCredentialsSheet(reviewPath, reviewCreds);
  await writeCredentialsHandoutPdf(handoutPath, [...officeCreds, ...reviewCreds]);

  console.log("\nBootstrap complete.");
  console.log(`  Office credentials: ${officePath}`);
  console.log(`  Chef/Wali credentials: ${reviewPath}`);
  console.log(`  Print handout (1 page/user): ${handoutPath}`);
  console.log("  Keep these files private — change passwords after first handoff if needed.");

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
