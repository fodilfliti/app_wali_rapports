"use strict";

/**
 * Bootstrap org-head creators from Word inventory:
 * - PRESIDENT_DAIRA / PRESIDENT_COMMUNE / DIRECTEUR_DIRECTION
 * - Seeds missing dairas + directions (مديريات) from inventory
 * - Daira: 4 services each (الوضع العام، التنمية المحلية، التربية و التكوين المهنية، اخرى)
 * - Commune / Direction: 1 service (الوضع العام)
 * - Grants manage on those services
 * - Credentials job_title uses Arabic unit name from DB (avoids FR+RTL garble in PDF)
 * - Directeur Identifiant prefix: `dir.` (migrates legacy `dd.*`)
 * - Each run: force-delete + rewrite Excel + PDF under private/bootstrap/org-heads/{daira,commune,direction}/
 *
 * Usage:
 *   npm run db:seed-org-heads
 *   (or: node scripts/seed-org-heads-bootstrap.js --confirm)
 *
 * Does NOT wipe diwan / wali / chef users. Upserts org-head users (new password each run).
 */

require("./load-env");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const {
  sequelize,
  User,
  Daira,
  Municipality,
  Direction,
  Service,
  UserServiceGrant,
  AccessRoleTemplate,
  RapportType,
} = require("../src/db");

const {
  dairaPresidents,
  communePresidents,
  directionDirecteurs,
  DAIRA_SERVICES,
  GENERAL_SERVICE,
} = require("./data/orgHeadsInventory");
const tlemcenMunicipalities = require("../src/db/seed-data/tlemcen-municipalities");
const tlemcenDairas = require("../src/db/seed-data/tlemcen-dairas");

const {
  writeCredentialsSheet,
  credentialRow,
} = require("./lib/prodCabinetUsers");
const { writeCredentialsHandoutPdf } = require("../src/services/credentialsPdfService");
const {
  buildFicheDefaultBlocks,
  letterheadContextFromService,
} = require("../src/modules/rapports/documentDefaults");
const { baseSlugFromNames, ensureUniqueSlug } = require("../src/utils/slugUtils");

const OUT_ROOT = path.join(__dirname, "..", "private", "bootstrap", "org-heads");

const TEMPLATE_BY_ROLE = {
  PRESIDENT_DAIRA: "DAIRA_STANDARD",
  PRESIDENT_COMMUNE: "COMMUNE_STANDARD",
  DIRECTEUR_DIRECTION: "DIRECTION_STANDARD",
};

const JOB_TITLE_BY_ROLE = {
  PRESIDENT_DAIRA: "رئيس الدائرة",
  PRESIDENT_COMMUNE: "الأمين العام للبلدية",
  DIRECTEUR_DIRECTION: "مدير المديرية",
};

/** Username prefixes (Identifiant). Directeur uses `dir.` — clearer than legacy `dd.`. */
const USERNAME_PREFIX = {
  PRESIDENT_DAIRA: "pd",
  PRESIDENT_COMMUNE: "pc",
  DIRECTEUR_DIRECTION: "dir",
};

function hasLatinLetters(s) {
  return /[A-Za-z]/.test(String(s || ""));
}

/** True if Arabic label is missing, junk, or mixed with Latin (causes PDF RTL garble). */
function isBadArabicUnitLabel(s) {
  const t = String(s || "").trim();
  if (!t) return true;
  if (hasLatinLetters(t)) return true;
  return looksLikeJunkDairaName(t);
}

function unitLabelAr(row, fallbackFr, preferredAr) {
  const preferred = String(preferredAr || "").trim();
  if (preferred && !isBadArabicUnitLabel(preferred)) return preferred;
  const ar = String(row?.name_ar || "").trim();
  if (ar && !isBadArabicUnitLabel(ar)) return ar;
  const fr = String(fallbackFr || row?.name_fr || "").trim();
  return fr || "—";
}

function jobTitleWithUnit(role, unitNameAr) {
  const base = JOB_TITLE_BY_ROLE[role] || "";
  const unit = String(unitNameAr || "").trim();
  return unit ? `${base} — ${unit}` : base;
}

function assertConfirm() {
  const confirmed =
    process.env.CONFIRM_ORG_HEADS_BOOTSTRAP === "YES" || process.argv.includes("--confirm");
  if (!confirmed) {
    console.error(`
Refusing to run. Creates/updates org-head users, seeds missing dairas/directions,
creates org-scoped services + grants, and rewrites private/bootstrap/org-heads/* credentials.

Run:
  npm run db:seed-org-heads
`);
    process.exit(1);
  }
}

function generatePassword8() {
  return String(crypto.randomInt(10_000_000, 100_000_000));
}

function normKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugPerson(name) {
  const base = baseSlugFromNames(name, name, "user");
  return base.slice(0, 40) || "user";
}

function slugUnit(name) {
  return baseSlugFromNames(name, name, "unit").slice(0, 40) || "unit";
}

async function templateId(slug) {
  const tpl = await AccessRoleTemplate.findOne({ where: { slug, is_active: true } });
  if (!tpl) throw new Error(`Missing template ${slug} — run migrations / seed-dev first`);
  return tpl.id;
}

async function ensureFicheOnService(service, letterheadCtx) {
  if (!service || service.is_folder) return;
  const existing = await RapportType.findOne({
    where: { service_id: service.id, content_kind: "fiche_lecture" },
  });
  if (existing) return existing;
  return RapportType.create({
    service_id: service.id,
    slug: "fiche_lecture",
    name_ar: "مذكرة استخلاصية",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: { default_blocks: buildFicheDefaultBlocks(letterheadCtx) },
  });
}

async function upsertOrgUser({
  username,
  name,
  role,
  job_title,
  daira_id,
  municipality_id,
  direction_id,
  password,
  legacyUsernames = [],
}) {
  const access_role_template_id = await templateId(TEMPLATE_BY_ROLE[role]);
  const password_hash = await bcrypt.hash(password, 10);
  let existing = await User.findOne({ where: { username } });
  if (!existing && legacyUsernames.length) {
    for (const legacy of legacyUsernames) {
      existing = await User.findOne({ where: { username: legacy } });
      if (existing) {
        await existing.update({ username });
        break;
      }
    }
  }
  if (existing) {
    await existing.update({
      name,
      role,
      job_title,
      daira_id: daira_id ?? null,
      municipality_id: municipality_id ?? null,
      direction_id: direction_id ?? null,
      access_role_template_id,
      password_hash,
      is_blocked: false,
      deleted_at: null,
    });
    await UserServiceGrant.destroy({ where: { user_id: existing.id } });
    return existing;
  }
  return User.create({
    username,
    name,
    role,
    job_title,
    daira_id: daira_id ?? null,
    municipality_id: municipality_id ?? null,
    direction_id: direction_id ?? null,
    access_role_template_id,
    password_hash,
    is_blocked: false,
    email: `${username.replace(/\./g, "_")}@org.local`,
    email_hidden: true,
    use_custom_permissions: false,
  });
}

function looksLikeJunkDairaName(s) {
  const t = String(s || "").trim();
  if (!t) return true;
  // Latin keyboard mash / test junk (e.g. dqsds) — not a real place name
  if (/^[a-z]{3,8}$/i.test(t) && !/[aeiouy]{2}|ch|gh|ou|ain|ben|el /i.test(t)) {
    return true;
  }
  return false;
}

async function findDairaByName(label, { code } = {}) {
  if (code) {
    const byCode = await Daira.findOne({ where: { code: String(code) } });
    if (byCode) return byCode;
  }

  const key = normKey(label);
  if (!key) return null;
  const aliases = {
    fillaoucene: "fellaoucene",
    benisnous: "beni snous",
    sebra: "sabra",
    "marsa ben mhidi": "marsa ben m hidi",
  };
  const want = aliases[key] || key;

  // Include soft-hidden (e.g. Mansourah 1351) — bootstrap will unhide.
  const rows = await Daira.findAll();
  let exact = null;
  let fuzzy = null;
  for (const r of rows) {
    const fr = normKey(r.name_fr);
    const ar = normKey(r.name_ar);
    if (!fr && !ar) continue;
    if (looksLikeJunkDairaName(r.name_ar) && !fr) continue;
    if ((fr && fr === want) || (ar && ar === want)) {
      exact = r;
      break;
    }
    // Avoid `want.includes("")` which is always true for empty fr.
    if (
      !fuzzy &&
      fr &&
      fr.length >= 3 &&
      (fr.includes(want) || (want.length >= 3 && want.includes(fr)))
    ) {
      fuzzy = r;
    }
  }
  return exact || fuzzy;
}

async function ensureDaira(entry) {
  const label = typeof entry === "string" ? entry : entry.daira;
  const code = typeof entry === "string" ? undefined : entry.code;
  const nameArHint = typeof entry === "string" ? undefined : entry.daira_ar;

  let row = await findDairaByName(label, { code });
  if (row) {
    const patch = {};
    if (row.hidden_at) patch.hidden_at = null;
    if (nameArHint && (looksLikeJunkDairaName(row.name_ar) || !String(row.name_ar || "").trim())) {
      patch.name_ar = nameArHint;
    }
    if (label && !String(row.name_fr || "").trim()) patch.name_fr = label;
    if (Object.keys(patch).length) await row.update(patch);
    return { row, created: false };
  }

  const newCode =
    code || `D${String(Date.now()).slice(-6)}${crypto.randomInt(10, 99)}`;
  row = await Daira.create({
    code: newCode,
    name_ar: nameArHint || label,
    name_fr: label,
  });
  console.log(`  + daira created: ${label} (${newCode})`);
  return { row, created: true };
}

/** Hide test junk dairas that break name matching (empty FR + mash AR). */
async function quarantineJunkDairas() {
  const rows = await Daira.findAll();
  for (const r of rows) {
    const fr = String(r.name_fr || "").trim();
    const ar = String(r.name_ar || "").trim();
    if (!fr && looksLikeJunkDairaName(ar)) {
      if (!r.hidden_at) {
        await r.update({ hidden_at: new Date() });
        console.log(`  ! quarantined junk daira id=${r.id} code=${r.code} ar=${ar}`);
      }
    }
  }
}

/**
 * Repair municipality / daira Arabic names corrupted with Latin letters
 * (e.g. "بensekrane", "منsurah") from canonical Tlemcen seed data.
 */
async function repairCorruptedUnitArabicNames() {
  let muniFixed = 0;
  let dairaFixed = 0;
  const muniByCode = Object.fromEntries(
    tlemcenMunicipalities.map((m) => [String(m.code), m]),
  );
  const dairaByCode = Object.fromEntries(tlemcenDairas.map((d) => [String(d.code), d]));

  const munis = await Municipality.findAll();
  for (const row of munis) {
    const canon = muniByCode[String(row.code)];
    if (!canon) continue;
    const patch = {};
    if (isBadArabicUnitLabel(row.name_ar) && canon.name_ar) {
      patch.name_ar = canon.name_ar;
    }
    if (!String(row.name_fr || "").trim() && canon.name_fr) {
      patch.name_fr = canon.name_fr;
    }
    if (Object.keys(patch).length) {
      await row.update(patch);
      muniFixed += 1;
      console.log(`  ~ commune ${row.code}: ${row.name_ar} → ${patch.name_ar || row.name_ar}`);
    }
  }

  const dairas = await Daira.findAll();
  for (const row of dairas) {
    const canon = dairaByCode[String(row.code)];
    if (!canon) continue;
    const patch = {};
    if (isBadArabicUnitLabel(row.name_ar) && canon.name_ar) {
      patch.name_ar = canon.name_ar;
    }
    if (!String(row.name_fr || "").trim() && canon.name_fr) {
      patch.name_fr = canon.name_fr;
    }
    if (Object.keys(patch).length) {
      await row.update(patch);
      dairaFixed += 1;
      console.log(`  ~ daira ${row.code}: ${row.name_ar} → ${patch.name_ar || row.name_ar}`);
    }
  }

  console.log(`  Repaired Arabic names: ${muniFixed} communes, ${dairaFixed} dairas`);
}

async function ensureDirection(entry) {
  const code = String(entry.code || "").trim().toUpperCase().slice(0, 50);
  let row = await Direction.findOne({ where: { code } });
  if (!row) {
    const key = normKey(entry.name_fr || entry.code);
    const all = await Direction.findAll({ where: { hidden_at: null } });
    row = all.find((d) => normKey(d.name_fr) === key || normKey(d.code) === key) || null;
  }
  if (row) {
    if (row.hidden_at) await row.update({ hidden_at: null });
    return { row, created: false };
  }
  row = await Direction.create({
    code,
    name_ar: entry.name_ar || entry.name_fr || code,
    name_fr: entry.name_fr || code,
  });
  console.log(`  + direction created: ${code} — ${entry.name_ar || entry.name_fr}`);
  return { row, created: true };
}

async function nextServiceSort() {
  const max = await Service.max("sort_order");
  return (max == null ? -1 : Number(max)) + 1;
}

async function ensureOrgLeafService({
  orgScope,
  unitFk,
  unitId,
  unitRow,
  def,
}) {
  const where = {
    org_scope: orgScope,
    is_active: true,
    is_folder: false,
    name_ar: def.name_ar,
    [unitFk]: unitId,
  };
  let service = await Service.findOne({ where });
  const letterheadCtx = letterheadContextFromService({
    org_scope: orgScope,
    daira: orgScope === "daira" ? unitRow : null,
    municipality: orgScope === "commune" ? unitRow : null,
    direction: orgScope === "direction" ? unitRow : null,
  });

  if (service) {
    await ensureFicheOnService(service, letterheadCtx);
    return { service, created: false };
  }

  const base = `${def.slugBase}--${orgScope}-${unitId}`;
  const slug = await ensureUniqueSlug(base.slice(0, 70), async (s) =>
    Service.findOne({ where: { slug: s } }),
  );
  const payload = {
    department_id: null,
    slug,
    name_ar: def.name_ar,
    name_fr: def.name_fr,
    sort_order: await nextServiceSort(),
    is_active: true,
    is_folder: false,
    parent_service_id: null,
    org_scope: orgScope,
    daira_id: null,
    municipality_id: null,
    direction_id: null,
  };
  payload[unitFk] = unitId;
  service = await Service.create(payload);
  await ensureFicheOnService(service, letterheadCtx);
  return { service, created: true };
}

async function grantManage(userId, serviceId) {
  await UserServiceGrant.findOrCreate({
    where: { user_id: userId, service_id: serviceId },
    defaults: { access_level: "manage" },
  });
  await UserServiceGrant.update(
    { access_level: "manage" },
    { where: { user_id: userId, service_id: serviceId } },
  );
}

function resetOutDir(subdir) {
  const dir = path.join(OUT_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    fs.unlinkSync(path.join(dir, name));
  }
  return dir;
}

async function writeBundle(subdir, rows) {
  const dir = resetOutDir(subdir);
  const xlsxPath = path.join(dir, `credentials-${subdir}.xlsx`);
  const pdfPath = path.join(dir, `credentials-${subdir}.pdf`);
  await writeCredentialsSheet(xlsxPath, rows);
  if (rows.length) await writeCredentialsHandoutPdf(pdfPath, rows);
  else fs.writeFileSync(pdfPath, ""); // should not happen
  console.log(`  Wrote ${rows.length} → ${xlsxPath}`);
  console.log(`  Wrote ${rows.length} → ${pdfPath}`);
  return { xlsxPath, pdfPath };
}

async function seedDairaUsers() {
  console.log("\n=== رؤساء الدوائر ===");
  const creds = [];
  let createdSvc = 0;

  for (const entry of dairaPresidents) {
    if (entry.skip || /^PI\b/i.test(entry.name) || entry.name.trim() === "/") {
      console.log(`  skip intérim: ${entry.daira}`);
      continue;
    }
    const { row: daira } = await ensureDaira(entry);
    const unitAr = unitLabelAr(daira, entry.daira, entry.daira_ar);
    const username = `${USERNAME_PREFIX.PRESIDENT_DAIRA}.${slugUnit(entry.daira)}`;
    const password = generatePassword8();
    const jobTitle = jobTitleWithUnit("PRESIDENT_DAIRA", unitAr);
    const user = await upsertOrgUser({
      username,
      name: entry.name,
      role: "PRESIDENT_DAIRA",
      job_title: jobTitle,
      daira_id: daira.id,
      password,
    });

    for (const def of DAIRA_SERVICES) {
      const { service, created } = await ensureOrgLeafService({
        orgScope: "daira",
        unitFk: "daira_id",
        unitId: daira.id,
        unitRow: daira,
        def,
      });
      if (created) createdSvc += 1;
      await grantManage(user.id, service.id);
    }

    creds.push(
      credentialRow({
        username,
        name: entry.name,
        password,
        job_title: jobTitle,
        role: "PRESIDENT_DAIRA",
      }),
    );
    console.log(`  ${username} ← ${unitAr} (${DAIRA_SERVICES.length} services)`);
  }

  await writeBundle("daira", creds);
  return { users: creds.length, servicesCreated: createdSvc };
}

async function seedCommuneUsers() {
  console.log("\n=== رؤساء / أمناء البلديات ===");
  const creds = [];
  let createdSvc = 0;
  let skipped = 0;

  for (const entry of communePresidents) {
    const canon = tlemcenMunicipalities.find((m) => String(m.code) === String(entry.code));
    let muni = await Municipality.findOne({ where: { code: entry.code } });
    if (!muni) {
      console.warn(`  ! commune code ${entry.code} not in DB — skip ${entry.commune}`);
      skipped += 1;
      continue;
    }
    if (muni.hidden_at) {
      await muni.update({ hidden_at: null });
      console.log(`  ~ unhid commune ${entry.code}`);
    }
    const preferredAr = canon?.name_ar || null;
    if (preferredAr && isBadArabicUnitLabel(muni.name_ar)) {
      await muni.update({ name_ar: preferredAr });
      await muni.reload();
    }
    const unitAr = unitLabelAr(muni, entry.commune, preferredAr);
    const username = `${USERNAME_PREFIX.PRESIDENT_COMMUNE}.${entry.code}`;
    const password = generatePassword8();
    const jobTitle = jobTitleWithUnit("PRESIDENT_COMMUNE", unitAr);
    const user = await upsertOrgUser({
      username,
      name: entry.name,
      role: "PRESIDENT_COMMUNE",
      job_title: jobTitle,
      municipality_id: muni.id,
      password,
    });

    const { service, created } = await ensureOrgLeafService({
      orgScope: "commune",
      unitFk: "municipality_id",
      unitId: muni.id,
      unitRow: muni,
      def: GENERAL_SERVICE,
    });
    if (created) createdSvc += 1;
    await grantManage(user.id, service.id);

    creds.push(
      credentialRow({
        username,
        name: entry.name,
        password,
        job_title: jobTitle,
        role: "PRESIDENT_COMMUNE",
      }),
    );
    console.log(`  ${username} ← ${unitAr}`);
  }

  await writeBundle("commune", creds);
  return { users: creds.length, servicesCreated: createdSvc, skipped };
}

async function seedDirectionUsers() {
  console.log("\n=== مديرو المديريات (seed directions + users) ===");
  const creds = [];
  let createdSvc = 0;
  let dirsCreated = 0;

  for (const entry of directionDirecteurs) {
    const { row: direction, created } = await ensureDirection(entry);
    if (created) dirsCreated += 1;

    const unitAr = unitLabelAr(direction, entry.name_ar || entry.name_fr || entry.code);
    const unitSlug = slugUnit(entry.code);
    const username = `${USERNAME_PREFIX.DIRECTEUR_DIRECTION}.${unitSlug}`;
    const password = generatePassword8();
    const jobTitle = jobTitleWithUnit("DIRECTEUR_DIRECTION", unitAr);
    const user = await upsertOrgUser({
      username,
      name: entry.person,
      role: "DIRECTEUR_DIRECTION",
      job_title: jobTitle,
      direction_id: direction.id,
      password,
      legacyUsernames: [`dd.${unitSlug}`],
    });

    const { service, created: svcCreated } = await ensureOrgLeafService({
      orgScope: "direction",
      unitFk: "direction_id",
      unitId: direction.id,
      unitRow: direction,
      def: GENERAL_SERVICE,
    });
    if (svcCreated) createdSvc += 1;
    await grantManage(user.id, service.id);

    creds.push(
      credentialRow({
        username,
        name: entry.person,
        password,
        job_title: jobTitle,
        role: "DIRECTEUR_DIRECTION",
      }),
    );
    console.log(`  ${username} ← ${unitAr}`);
  }

  await writeBundle("direction", creds);
  return { users: creds.length, servicesCreated: createdSvc, dirsCreated };
}

async function main() {
  assertConfirm();
  await sequelize.authenticate();

  console.log("Org-heads bootstrap starting…");
  console.log(`Credentials root: ${OUT_ROOT}`);
  await quarantineJunkDairas();
  await repairCorruptedUnitArabicNames();

  const d = await seedDairaUsers();
  const c = await seedCommuneUsers();
  const dir = await seedDirectionUsers();

  console.log("\nDone.");
  console.log(`  Daira users: ${d.users} (services created this run: ${d.servicesCreated})`);
  console.log(`  Commune users: ${c.users} (skipped missing communes: ${c.skipped})`);
  console.log(`  Direction users: ${dir.users} (directions created: ${dir.dirsCreated})`);
  console.log("  Folders (force-recreated each run):");
  console.log(`    ${path.join(OUT_ROOT, "daira")}`);
  console.log(`    ${path.join(OUT_ROOT, "commune")}`);
  console.log(`    ${path.join(OUT_ROOT, "direction")}`);

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
