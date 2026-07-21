"use strict";

/**
 * Production-safe: create missing fiche_lecture types on every leaf service.
 * No wipe. No user/password changes. Idempotent.
 *
 * Usage (cPanel / prod):
 *   npm run db:ensure-fiche-lecture
 */

require("./load-env");

const { sequelize, Service, RapportType } = require("../src/db");
const { ensureFicheLectureType } = require("./lib/prodCabinetUsers");

async function main() {
  await sequelize.authenticate();

  const leaves = await Service.findAll({
    where: { is_folder: false },
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });

  let created = 0;
  let skipped = 0;

  for (const leaf of leaves) {
    const existing = await RapportType.findOne({
      where: { service_id: leaf.id, content_kind: "fiche_lecture" },
    });
    if (existing) {
      skipped += 1;
      console.log(`  skip (exists): ${leaf.slug}`);
      continue;
    }
    await ensureFicheLectureType(leaf);
    created += 1;
    console.log(`  created: ${leaf.slug} (${leaf.name_ar})`);
  }

  console.log(
    `\nDone. fiche_lecture: +${created} created, ${skipped} already present, ${leaves.length} leaf services.`,
  );
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
