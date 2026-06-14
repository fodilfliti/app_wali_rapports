"use strict";

/**
 * Reset services + rapports and seed test data for all content kinds / versioning options.
 * Usage: npm run db:seed-test
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const {
  sequelize,
  Department,
  User,
  AccessRoleTemplate,
  Service,
  RapportType,
  RapportTableSchema,
  Rapport,
  RapportVersion,
  WaliResponse,
  Notification,
  UserServiceGrant,
  Municipality,
} = require("../src/db");

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test1234!";

const TABLE_COLS = [
  { key: "label", type: "text", label_ar: "الوصف", label_fr: "Description" },
  {
    key: "amount",
    type: "number",
    format: "currency",
    label_ar: "المبلغ (دج)",
    label_fr: "Montant (DA)",
  },
  { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
];

const COMMUNE_TABLE_COLS = [
  {
    key: "municipality_code",
    type: "commune_ref",
    label_ar: "البلدية",
    label_fr: "Commune",
  },
  {
    key: "indicator",
    type: "number",
    format: "integer",
    label_ar: "المؤشر",
    label_fr: "Indicateur",
  },
  { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
];

function tableRows(valuesList) {
  return valuesList.map((vals) => ({
    _row_finished: false,
    _wali_visible: true,
    _cell_colors: {},
    _highlight: "none",
    ...vals,
  }));
}

function communeTableRow(code, indicator, notes) {
  return {
    municipality_code: code,
    indicator,
    notes,
    _row_finished: false,
    _wali_visible: true,
    _cell_colors: {},
    _highlight: "none",
  };
}

function documentBlocks(titleAr, titleFr, bodyAr, bodyFr) {
  return [
    {
      type: "heading",
      align: "center",
      bold: true,
      text_ar: titleAr,
      text_fr: titleFr,
    },
    { type: "paragraph", text_ar: bodyAr, text_fr: bodyFr },
  ];
}

async function clearRapportDomain() {
  await sequelize.query("UPDATE rapports SET current_version_id = NULL");
  const tables = [
    "notifications",
    "wali_broadcast_comments",
    "wali_broadcast_recipients",
    "wali_broadcasts",
    "rapport_views",
    "rapport_calendar_events",
    "uploaded_files",
    "wali_responses",
    "rapport_versions",
    "rapports",
    "user_service_grants",
    "rapport_document_templates",
    "rapport_types",
    "rapport_table_schemas",
  ];
  for (const table of tables) {
    await sequelize.query(`DELETE FROM ${table}`);
  }
  await sequelize.query("UPDATE services SET parent_service_id = NULL");
  await sequelize.query("DELETE FROM services");
  console.log("Cleared services, rapports, versions, and related data.");
}

async function ensureUser({ username, name, role, templateSlug }) {
  const template = await AccessRoleTemplate.findOne({ where: { slug: templateSlug } });
  if (!template) throw new Error(`Missing role template: ${templateSlug}`);
  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  let user = await User.scope("withPassword").findOne({ where: { username } });
  if (user) {
    await user.update({
      name,
      role,
      password_hash: hash,
      access_role_template_id: template.id,
      is_blocked: false,
    });
  } else {
    user = await User.create({
      username,
      name,
      email: `${username}@test.local`,
      password_hash: hash,
      role,
      access_role_template_id: template.id,
      is_blocked: false,
      use_custom_permissions: false,
      email_hidden: false,
    });
  }
  return user;
}

async function createService(deptId, slug, nameAr, nameFr, sortOrder) {
  return Service.create({
    department_id: deptId,
    slug,
    name_ar: nameAr,
    name_fr: nameFr,
    sort_order: sortOrder,
    is_active: true,
    is_folder: false,
    parent_service_id: null,
  });
}

async function createSchema(slug, nameAr, nameFr, columns, serviceId = null) {
  return RapportTableSchema.create({
    service_id: serviceId,
    slug,
    name_ar: nameAr,
    name_fr: nameFr,
    columns_json: columns,
    layout_json: {},
    is_system: false,
  });
}

async function createType(serviceId, spec) {
  return RapportType.create({
    service_id: serviceId,
    slug: spec.slug,
    name_ar: spec.name_ar,
    name_fr: spec.name_fr,
    layout_kind: spec.layout_kind,
    content_kind: spec.content_kind,
    versioning_mode: spec.versioning_mode,
    commune_content_kind: spec.commune_content_kind || "complex",
    schema_json: spec.schema_json,
  });
}

async function createRapportWithVersions({
  serviceId,
  typeId,
  title,
  ownerId,
  authorId,
  status,
  versions,
  waliResponses = [],
}) {
  const rapport = await Rapport.create({
    service_id: serviceId,
    rapport_type_id: typeId,
    title,
    status: "draft",
    created_by_user_id: authorId,
    owner_office_user_id: ownerId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const versionRows = [];
  for (const v of versions) {
    const row = await RapportVersion.create({
      rapport_id: rapport.id,
      version_number: v.number,
      data_json: v.data_json,
      submitted_at: v.submitted_at || null,
      created_by_user_id: authorId,
      created_at: v.submitted_at || new Date(),
    });
    versionRows.push(row);
  }

  const current = versionRows[versionRows.length - 1];
  await rapport.update({
    current_version_id: current.id,
    status,
    updated_at: new Date(),
  });

  for (const wr of waliResponses) {
    const targetVersion = versionRows.find((r) => r.version_number === wr.versionNumber);
    if (!targetVersion) continue;
    const response = await WaliResponse.create({
      rapport_id: rapport.id,
      rapport_version_id: targetVersion.id,
      decision: wr.decision,
      follow_up_status: "none",
      body_text: wr.body_text || "",
      scope: "whole_rapport",
      created_by_user_id: wr.waliUserId,
      created_at: wr.created_at || new Date(),
    });
    if (wr.notifyOffice) {
      await Notification.create({
        user_id: ownerId,
        rapport_id: rapport.id,
        wali_response_id: response.id,
        message_key: "waliChangesRequested",
        created_at: new Date(),
      });
    }
  }

  return { rapport, versions: versionRows };
}

async function seedFixtures() {
  let dept = await Department.findOne({ order: [["sort_order", "ASC"]] });
  if (!dept) {
    dept = await Department.create({
      name_ar: "اختبار",
      name_fr: "Test",
      sort_order: 99,
      is_active: true,
    });
  }

  const office = await ensureUser({
    username: "office1",
    name: "موظف مكتب — اختبار",
    role: "OFFICE_USER",
    templateSlug: "OFFICE_STANDARD",
  });
  const wali = await ensureUser({
    username: "wali1",
    name: "والي — اختبار",
    role: "WALI",
    templateSlug: "WALI_STANDARD",
  });

  const munCount = await Municipality.count();
  if (munCount === 0) {
    throw new Error("No municipalities — run npm run db:seed-dev first.");
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

  const schemaSnap = { columns: TABLE_COLS, layout_json: {} };
  const communeSchemaSnap = { columns: COMMUNE_TABLE_COLS, layout_json: {} };

  // --- Services & types ---
  const svcTable = await createService(
    dept.id,
    "test-table-versioned",
    "اختبار — جدول (نسخ)",
    "Test — Tableau versionné",
    1,
  );
  await createSchema(
    "test-table-schema",
    "جدول اختبار",
    "Schéma test",
    TABLE_COLS,
    svcTable.id,
  );
  const typeTable = await createType(svcTable.id, {
    slug: "test_table_grid",
    name_ar: "جدول اختبار",
    name_fr: "Grille test",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "test-table-schema", table_key: "main" },
  });

  const svcDoc = await createService(
    dept.id,
    "test-document",
    "اختبار — مستند",
    "Test — Document",
    2,
  );
  const typeDoc = await createType(svcDoc.id, {
    slug: "test_document",
    name_ar: "مستند اختبار",
    name_fr: "Document test",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "standalone",
    schema_json: {
      default_blocks: documentBlocks(
        "مستند تجريبي",
        "Document de test",
        "فقرة تجريبية للمستند.",
        "Paragraphe de test.",
      ),
    },
  });

  const svcFiche = await createService(
    dept.id,
    "test-fiche",
    "اختبار — بطاقة مطالعة",
    "Test — Fiche lecture",
    3,
  );
  const typeFiche = await createType(svcFiche.id, {
    slug: "test_fiche",
    name_ar: "بطاقة مطالعة",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: null,
  });

  const svcCommuneTable = await createService(
    dept.id,
    "test-commune-table",
    "اختبار — بلديات (جدول)",
    "Test — Communes (tableau)",
    4,
  );
  await createSchema(
    "test-commune-table-schema",
    "جدول بلديات",
    "Schéma communes",
    COMMUNE_TABLE_COLS,
    svcCommuneTable.id,
  );
  const typeCommuneTable = await createType(svcCommuneTable.id, {
    slug: "test_commune_table",
    name_ar: "قائمة بلديات — جدول",
    name_fr: "Communes — grille",
    layout_kind: "grid",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "table",
    schema_json: {
      table_schema_slug: "test-commune-table-schema",
      table_key: "main",
    },
  });

  const svcCommuneComplex = await createService(
    dept.id,
    "test-commune-complex",
    "اختبار — بلديات (نموذج)",
    "Test — Communes (formulaire)",
    5,
  );
  const typeCommuneComplex = await createType(svcCommuneComplex.id, {
    slug: "test_commune_complex",
    name_ar: "قائمة بلديات — نموذج",
    name_fr: "Communes — formulaire",
    layout_kind: "memo",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    schema_json: null,
  });

  const services = [svcTable, svcDoc, svcFiche, svcCommuneTable, svcCommuneComplex];
  for (const svc of services) {
    await UserServiceGrant.create({
      user_id: office.id,
      service_id: svc.id,
      access_level: "manage",
    });
  }

  const v1TableData = {
    schema_snapshot: schemaSnap,
    tables: [
      {
        key: "main",
        title_ar: "جدول اختبار",
        title_fr: "Grille test",
        rows: tableRows([
          { label: "الصف الأول — v1", amount: 100000, notes: "نسخة 1" },
          { label: "الصف الثاني — v1", amount: 250000, notes: "مرسلة للوالي" },
        ]),
      },
    ],
  };
  const v2TableData = {
    schema_snapshot: schemaSnap,
    tables: [
      {
        key: "main",
        title_ar: "جدول اختبار",
        title_fr: "Grille test",
        rows: tableRows([
          { label: "الصف الأول — v2", amount: 120000, notes: "مسودة بعد طلب تعديل" },
          { label: "الصف الثاني — v2", amount: 280000, notes: "قيد التحرير" },
          { label: "صف جديد — v2", amount: 50000, notes: "إضافة" },
        ]),
      },
    ],
  };

  const rTableVersions = await createRapportWithVersions({
    serviceId: svcTable.id,
    typeId: typeTable.id,
    title: `جدول اختبار — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "changes_requested",
    versions: [
      { number: 1, data_json: v1TableData, submitted_at: twoDaysAgo },
      { number: 2, data_json: v2TableData, submitted_at: null },
    ],
    waliResponses: [
      {
        versionNumber: 1,
        decision: "changes_requested",
        body_text: "يرجى تعديل المبالغ وإضافة صف ثالث.",
        waliUserId: wali.id,
        notifyOffice: true,
        created_at: dayAgo,
      },
    ],
  });

  await createRapportWithVersions({
    serviceId: svcTable.id,
    typeId: typeTable.id,
    title: `جدول مرسل (v1 فقط) — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    versions: [
      {
        number: 1,
        data_json: {
          schema_snapshot: schemaSnap,
          tables: [
            {
              key: "main",
              rows: tableRows([
                { label: "تقرير للقراءة", amount: 99999, notes: "نسخة واحدة" },
              ]),
            },
          ],
        },
        submitted_at: dayAgo,
      },
    ],
  });

  await createRapportWithVersions({
    serviceId: svcDoc.id,
    typeId: typeDoc.id,
    title: `مستند مسودة — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "draft",
    versions: [
      {
        number: 1,
        data_json: {
          blocks: documentBlocks(
            "مسودة مستند",
            "Brouillon document",
            "هذا مستند standalone في وضع المسودة.",
            "Document standalone en brouillon.",
          ),
          rich_html_ar: "<p>محتوى HTML تجريبي</p>",
          rich_html_fr: "<p>Contenu HTML de test</p>",
        },
      },
    ],
  });

  await createRapportWithVersions({
    serviceId: svcFiche.id,
    typeId: typeFiche.id,
    title: `بطاقة مطالعة — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    versions: [
      {
        number: 1,
        data_json: {
          blocks: documentBlocks(
            "بطاقة مطالعة مشتركة",
            "Fiche lecture partagée",
            "محتوى البطاقة المرسلة.",
            "Contenu de la fiche envoyée.",
          ),
        },
        submitted_at: dayAgo,
      },
    ],
  });

  const v1Communes = {
    "1301": { rows: [communeTableRow("1301", 10, "تلمسان — v1")] },
    "1302": { rows: [communeTableRow("1302", 20, "بني مستar — v1")] },
    "1303": { rows: [communeTableRow("1303", 15, "عين تalout — v1")] },
  };
  const v2Communes = {
    "1301": { rows: [communeTableRow("1301", 12, "تلمسان — v2 معدّل")] },
    "1302": { rows: [communeTableRow("1302", 22, "بني مستar — v2")] },
    "1304": { rows: [communeTableRow("1304", 8, "الرمشي — جديد v2")] },
  };

  await createRapportWithVersions({
    serviceId: svcCommuneTable.id,
    typeId: typeCommuneTable.id,
    title: `بلديات جدول — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "changes_requested",
    versions: [
      {
        number: 1,
        data_json: { communes: v1Communes, schema_snapshot: communeSchemaSnap },
        submitted_at: twoDaysAgo,
      },
      { number: 2, data_json: { communes: v2Communes }, submitted_at: null },
    ],
    waliResponses: [
      {
        versionNumber: 1,
        decision: "changes_requested",
        body_text: "حدّث بيانات البلديات المعدّلة.",
        waliUserId: wali.id,
        notifyOffice: true,
      },
    ],
  });

  await createRapportWithVersions({
    serviceId: svcCommuneComplex.id,
    typeId: typeCommuneComplex.id,
    title: `بلديات نموذج — ${now.toISOString().slice(0, 10)}`,
    ownerId: office.id,
    authorId: office.id,
    status: "draft",
    versions: [
      {
        number: 1,
        data_json: {
          communes: {
            "1301": {
              blocks: documentBlocks(
                "تلمسان",
                "Tlemcen",
                "نص تجريبي للبلدية.",
                "Texte test commune.",
              ),
            },
            "1305": {
              blocks: documentBlocks(
                "صبرة",
                "Sabra",
                "محتوى بلدية ثانية.",
                "Deuxième commune.",
              ),
            },
          },
        },
      },
    ],
  });

  console.log("\n=== Test fixtures created ===\n");
  console.log("Logins (password for all test users):");
  console.log(`  office1 / ${TEST_PASSWORD}  — edit & submit`);
  console.log(`  wali1   / ${TEST_PASSWORD}  — inbox & respond`);
  console.log(`  admin   — (your .env DEV_ADMIN_PASSWORD)\n`);
  console.log("Services (office1 has manage on all):");
  for (const s of services) {
    console.log(`  [${s.id}] ${s.slug} — ${s.name_ar}`);
  }
  console.log("\nVersioned table (2 versions, changes_requested):");
  console.log(`  rapport id ${rTableVersions.rapport.id} — archive should show v1 + v2`);
  console.log("\nRe-run anytime: npm run db:seed-test\n");
}

async function main() {
  try {
    await sequelize.authenticate();
    await clearRapportDomain();
    await seedFixtures();
  } catch (err) {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
