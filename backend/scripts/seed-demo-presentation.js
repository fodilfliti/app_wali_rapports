"use strict";

/**
 * Full presentation reset + seed (Hydraulique + Investissement).
 * Each run WIPE-then-seed: clears all demo/test domain data and non-admin users,
 * then rebuilds from this script. Safe to re-run while iterating on the seed.
 * Usage: npm run db:seed-demo
 * Keeps: ADMIN user(s), dairas/communes (seed-dev), access role templates.
 * Guide videos / broadcasts reuse files under backend/storage/uploads/ when present.
 */

require("./load-env");

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const bcrypt = require("bcryptjs");
const {
  sequelize,
  Department,
  User,
  AccessRoleTemplate,
  Service,
  RapportType,
  RapportTableSchema,
  RapportDocumentTemplate,
  Rapport,
  RapportVersion,
  WaliResponse,
  ChefResponse,
  Notification,
  UserServiceGrant,
  Municipality,
  Daira,
  Direction,
  RapportCalendarEvent,
  RapportComment,
  UploadedFile,
  WaliBroadcast,
  WaliBroadcastRecipient,
  WaliBroadcastComment,
  WaliInstruction,
  WaliInstructionRecipient,
  GuideVideo,
} = require("../src/db");
const {
  buildOfficialHeaderBlocks,
  buildFicheDefaultBlocks,
  buildCommuneDocumentDefaultBlocks,
} = require("../src/modules/rapports/documentDefaults");
const { entityKey } = require("../src/modules/rapports/entityKeys");
const {
  rowMeta,
  headingBlock,
  paragraphBlock,
  communeStatusTable,
  buildCommuneComplexEntry,
  buildHydFicheDataJson,
  buildInvFicheDataJson,
  hydBarrageCols,
  hydBarrageLayout,
  invCols,
  invLayout,
} = require("./lib/demoPresentationData");

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test1234!";
const UPLOADS_DIR = path.join(__dirname, "..", "storage", "uploads");

async function clearAllDomain() {
  console.log("Wiping previous demo/test data (start from scratch)...");

  // Break rapport → version FK before deleting versions.
  await sequelize.query("UPDATE rapports SET current_version_id = NULL");

  // Transactional / feature tables (FK-safe order).
  const tables = [
    "notifications",
    "wali_broadcast_comments",
    "wali_broadcast_recipients",
    "wali_broadcasts",
    "wali_instruction_recipients",
    "wali_instruction_files",
    "wali_instructions",
    "guide_videos",
    "rapport_comments",
    "chef_responses",
    "rapport_views",
    "rapport_calendar_events",
    "wali_responses",
    "rapport_versions",
    "rapports",
    "uploaded_files",
    "user_service_grants",
    "rapport_document_templates",
    "rapport_types",
    "rapport_table_schemas",
    "refresh_tokens",
    "user_permission_overrides",
    "audit_logs",
  ];
  for (const table of tables) {
    await sequelize.query(`DELETE FROM ${table}`);
  }

  // Detach users from departments, then drop org tree.
  await sequelize.query("UPDATE users SET department_id = NULL");
  await sequelize.query("UPDATE services SET parent_service_id = NULL");
  await sequelize.query("DELETE FROM services");
  await sequelize.query("DELETE FROM departments");

  // Remove leftover test accounts (keep ADMIN from seed-dev). Demo users recreated below.
  const [deletedUsers] = await sequelize.query(
    `DELETE FROM users WHERE role <> 'ADMIN' RETURNING username`,
  );
  const removedNames = (deletedUsers || []).map((r) => r.username).filter(Boolean);
  if (removedNames.length) {
    console.log(`  Removed non-admin users: ${removedNames.join(", ")}`);
  }

  // Directions are demo-only — wipe all; Tlemcen dairas/communes stay (reference).
  await sequelize.query("DELETE FROM directions");

  // Clear soft-hide flags left from previous demo runs / manual testing.
  await sequelize.query("UPDATE dairas SET hidden_at = NULL");
  await sequelize.query("UPDATE municipalities SET hidden_at = NULL");

  console.log("Cleared domain data. Seeding fresh demo set...");
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
      email: `${username}@demo.local`,
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

async function createDepartment(nameAr, nameFr, sortOrder) {
  return Department.create({
    name_ar: nameAr,
    name_fr: nameFr,
    sort_order: sortOrder,
    is_active: true,
  });
}

async function createService(deptId, slug, nameAr, nameFr, sortOrder) {
  const service = await Service.create({
    department_id: deptId,
    slug,
    name_ar: nameAr,
    name_fr: nameFr,
    sort_order: sortOrder,
    is_active: true,
    is_folder: false,
    parent_service_id: null,
  });
  await RapportType.create({
    service_id: service.id,
    slug: "fiche_lecture",
    name_ar: "مذكرة استخلاصية",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: { default_blocks: buildFicheDefaultBlocks() },
  });
  return service;
}

async function createSchema(slug, nameAr, nameFr, columns, layoutJson, serviceId) {
  return RapportTableSchema.create({
    service_id: serviceId,
    slug,
    name_ar: nameAr,
    name_fr: nameFr,
    columns_json: columns,
    layout_json: layoutJson || {},
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
    entity_target_kinds: spec.entity_target_kinds || ["commune"],
    schema_json: spec.schema_json,
    hidden_at: spec.hidden_at || null,
  });
}

async function createTemplate(serviceId, spec) {
  return RapportDocumentTemplate.create({
    service_id: serviceId,
    rapport_type_id: spec.typeId || null,
    rapport_type_ids: spec.typeIds || (spec.typeId ? [spec.typeId] : []),
    slug: spec.slug,
    name_ar: spec.name_ar,
    name_fr: spec.name_fr,
    content_kind: spec.content_kind,
    is_default: !!spec.is_default,
    content_json: spec.content_json,
  });
}

async function createRapportBundle({
  serviceId,
  typeId,
  title,
  ownerId,
  authorId,
  status,
  versions,
  chefGate = "required",
  hiddenAt = null,
  waliResponses = [],
  chefResponses = [],
  calendarEvents = [],
}) {
  const rapport = await Rapport.create({
    service_id: serviceId,
    rapport_type_id: typeId,
    title,
    status: "draft",
    chef_gate: chefGate,
    hidden_at: hiddenAt,
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
      changed_entity_keys: v.changed_entity_keys || null,
      changed_commune_codes: v.changed_commune_codes || null,
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
    chef_gate: chefGate,
    hidden_at: hiddenAt,
    updated_at: new Date(),
  });

  for (const wr of waliResponses) {
    const targetVersion = versionRows.find((r) => r.version_number === wr.versionNumber);
    if (!targetVersion) continue;
    const response = await WaliResponse.create({
      rapport_id: rapport.id,
      rapport_version_id: targetVersion.id,
      decision: wr.decision,
      follow_up_status: wr.follow_up_status || "none",
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
        message_key: wr.messageKey || "waliChangesRequested",
        created_at: new Date(),
      });
    }
  }

  for (const cr of chefResponses) {
    const targetVersion = versionRows.find((r) => r.version_number === cr.versionNumber);
    if (!targetVersion) continue;
    const response = await ChefResponse.create({
      rapport_id: rapport.id,
      rapport_version_id: targetVersion.id,
      decision: cr.decision,
      follow_up_status: cr.follow_up_status || "none",
      body_text: cr.body_text || "",
      scope: "whole_rapport",
      created_by_user_id: cr.chefUserId,
      created_at: cr.created_at || new Date(),
    });
    if (cr.notifyOffice) {
      await Notification.create({
        user_id: ownerId,
        rapport_id: rapport.id,
        chef_response_id: response.id,
        message_key: cr.messageKey || "chefAccepted",
        created_at: new Date(),
      });
    }
  }

  for (const ev of calendarEvents) {
    await RapportCalendarEvent.create({
      rapport_id: rapport.id,
      event_date: ev.event_date,
      title_ar: ev.title_ar || "",
      title_fr: ev.title_fr || "",
      note_ar: ev.note_ar || null,
      note_fr: ev.note_fr || null,
      created_by_user_id: authorId,
      updated_at: new Date(),
    });
  }

  return { rapport, versions: versionRows };
}

function listUploadFiles(exts) {
  if (!fs.existsSync(UPLOADS_DIR)) return [];
  return fs
    .readdirSync(UPLOADS_DIR)
    .filter((name) => exts.some((ext) => name.toLowerCase().endsWith(ext)))
    .map((name) => {
      const full = path.join(UPLOADS_DIR, name);
      const stat = fs.statSync(full);
      return { name, full, size: stat.size };
    })
    .sort((a, b) => a.size - b.size);
}

async function registerUploadedFile({ storageKey, originalName, mimeType, sizeBytes, mediaKind, uploadedByUserId }) {
  return UploadedFile.create({
    storage_key: storageKey,
    rapport_id: null,
    uploaded_by_user_id: uploadedByUserId,
    original_name: originalName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    media_kind: mediaKind,
    storage_rel_path: `uploads/${storageKey}`,
    created_at: new Date(),
  });
}

async function ensureDemoDirections() {
  const specs = [
    { code: "DIR01", name_ar: "مديرية الموارد المائية", name_fr: "Direction des ressources en eau" },
    { code: "DIR02", name_ar: "مديرية الاستثمار", name_fr: "Direction de l'investissement" },
    { code: "DIR03", name_ar: "مديرية التعمير", name_fr: "Direction de l'urbanisme" },
  ];
  const rows = [];
  for (const spec of specs) {
    const row = await Direction.create({
      code: spec.code,
      name_ar: spec.name_ar,
      name_fr: spec.name_fr,
      created_at: new Date(),
      hidden_at: null,
    });
    rows.push(row);
  }
  return rows;
}

async function seedDemo() {
  if ((await Municipality.count()) === 0) {
    throw new Error("No municipalities — run npm run db:seed-dev first.");
  }

  const office = await ensureUser({
    username: "office1",
    name: "موظف المصلحة — عرض تجريبي",
    role: "OFFICE_USER",
    templateSlug: "OFFICE_STANDARD",
  });
  const officeView = await ensureUser({
    username: "office2",
    name: "موظف اطلاع — عرض تجريبي",
    role: "OFFICE_USER",
    templateSlug: "OFFICE_STANDARD",
  });
  const chef = await ensureUser({
    username: "chef1",
    name: "رئيس الديوان — عرض تجريبي",
    role: "CHEF_CABINET",
    templateSlug: "CHEF_STANDARD",
  });
  const wali = await ensureUser({
    username: "wali1",
    name: "والي — عرض تجريبي",
    role: "WALI",
    templateSlug: "WALI_STANDARD",
  });
  const admin =
    (await User.findOne({ where: { role: "ADMIN" }, order: [["id", "ASC"]] })) ||
    (await ensureUser({
      username: "admin",
      name: "مسؤول النظام — عرض تجريبي",
      role: "ADMIN",
      templateSlug: "ADMIN_FULL",
    }));

  const directions = await ensureDemoDirections();
  const dirHyd = directions.find((d) => d.code === "DIR01");
  const dirInv = directions.find((d) => d.code === "DIR02");
  const dirUrban = directions.find((d) => d.code === "DIR03");

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const weekAnchor = now.toISOString().slice(0, 10);

  const deptHyd = await createDepartment("مصلحة الموارد المائية", "Direction Hydraulique", 1);
  const deptInv = await createDepartment("مصلحة الاستثمار", "Direction Investissement", 2);

  const svcHyd = await createService(
    deptHyd.id,
    "hydraulique",
    "مصلحة المياه",
    "Service Hydraulique",
    1,
  );
  const svcInv = await createService(
    deptInv.id,
    "investissement",
    "مصلحة الاستثمار",
    "Service Investissement",
    2,
  );

  const hydBarrageCols = [
    {
      key: "dam_name",
      type: "text",
      label_ar: "اسم السد",
      label_fr: "Nom du barrage",
      merge_vertical_suggested: true,
    },
    {
      key: "capacity_m3",
      type: "number",
      format: "integer",
      footer_aggregate: "sum",
      label_ar: "السعة (م³)",
      label_fr: "Capacité (m³)",
    },
    {
      key: "fill_pct",
      type: "number",
      format: "percent",
      label_ar: "نسبة الملء",
      label_fr: "Taux de remplissage",
    },
    {
      key: "alert_level",
      type: "choice",
      label_ar: "مستوى التنبيه",
      label_fr: "Niveau d'alerte",
      choices: [
        { value: "normal", label_ar: "عادي", label_fr: "Normal" },
        { value: "watch", label_ar: "مراقبة", label_fr: "Surveillance" },
        { value: "critical", label_ar: "حرج", label_fr: "Critique" },
      ],
    },
    {
      key: "notes",
      type: "text",
      label_ar: "ملاحظات",
      label_fr: "Observations",
    },
  ];

  const hydBarrageLayout = {
    header_groups: [
      {
        label_ar: "بيانات السد",
        label_fr: "Données barrage",
        column_keys: ["dam_name", "capacity_m3"],
      },
      {
        label_ar: "متابعة",
        label_fr: "Suivi",
        column_keys: ["fill_pct", "alert_level", "notes"],
      },
    ],
    default_title_ar: "حالة السدود — ولاية تlemسان",
    default_title_fr: "État des barrages — Wilaya de Tlemcen",
    default_subtitle_ar: "تقرير دوري",
    default_subtitle_fr: "Rapport périodique",
  };

  await createSchema(
    "hydraulique-barrages",
    "جدول السدود",
    "Tableau des barrages",
    hydBarrageCols,
    hydBarrageLayout,
    svcHyd.id,
  );

  const invCols = [
    {
      key: "project_title",
      type: "text",
      label_ar: "عنوان المشروع",
      label_fr: "Intitulé du projet",
      merge_vertical_suggested: true,
    },
    {
      key: "owner",
      type: "text",
      label_ar: "صاحب المشروع",
      label_fr: "Maître d'ouvrage",
    },
    {
      key: "municipality_code",
      type: "commune_ref",
      label_ar: "البلدية",
      label_fr: "Commune",
    },
    {
      key: "total_amount",
      type: "number",
      format: "currency",
      footer_aggregate: "sum",
      label_ar: "المبلغ الإجمالي (دج)",
      label_fr: "Montant total (DA)",
    },
    {
      key: "completion_pct",
      type: "number",
      format: "percent",
      label_ar: "نسبة الإنجاز",
      label_fr: "Taux d'avancement",
    },
    {
      key: "remaining_pct",
      type: "formula",
      formula: "100 - completion_pct",
      format: "percent",
      label_ar: "المتبقي %",
      label_fr: "Reste %",
    },
    { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
  ];

  const invLayout = {
    header_groups: [
      {
        label_ar: "المشروع",
        label_fr: "Projet",
        column_keys: ["project_title", "owner", "municipality_code"],
      },
      {
        label_ar: "مالي",
        label_fr: "Financier",
        column_keys: ["total_amount", "completion_pct", "remaining_pct", "notes"],
      },
    ],
    default_title_ar: "متابعة تسوية المشاريع الاستثمارية",
    default_title_fr: "Suivi des projets d'investissement",
    default_subtitle_ar: "نتائج أشغال الخلية الولائية — 2026",
    default_subtitle_fr: "Travaux cellule wilaya — 2026",
  };

  await createSchema(
    "investissement-projets",
    "جدول المشاريع",
    "Tableau des projets",
    invCols,
    invLayout,
    svcInv.id,
  );

  const hydSchemaSnap = { columns: hydBarrageCols, layout_json: hydBarrageLayout };
  const invSchemaSnap = { columns: invCols, layout_json: invLayout };

  const typeHydTable = await createType(svcHyd.id, {
    slug: "barrages_etat",
    name_ar: "حالة السدود",
    name_fr: "État des barrages",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "hydraulique-barrages", table_key: "main" },
  });

  const typeHydDoc = await createType(svcHyd.id, {
    slug: "distribution_eau",
    name_ar: "برنامج توزيع المياه",
    name_fr: "Programme distribution eau",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "standalone",
    schema_json: null,
  });

  const typeHydCommune = await createType(svcHyd.id, {
    slug: "distribution_communes",
    name_ar: "متابعة التوزيع حسب البلدية",
    name_fr: "Suivi distribution par commune",
    layout_kind: "memo",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    schema_json: null,
  });

  const typeInvTable = await createType(svcInv.id, {
    slug: "projets_investissement",
    name_ar: "تسوية المشاريع الاستثمارية",
    name_fr: "Projets investissement",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "investissement-projets", table_key: "main" },
  });

  const typeInvCommune = await createType(svcInv.id, {
    slug: "projets_par_commune",
    name_ar: "المشاريع حسب البلدية / الدائرة / المديرية",
    name_fr: "Projets par commune / daïra / direction",
    layout_kind: "grid",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "table",
    entity_target_kinds: ["commune", "daira", "direction"],
    schema_json: { table_schema_slug: "investissement-projets", table_key: "main" },
  });

  // Soft-hide demo type (non-fiche) — restore from admin/office type list.
  await createType(svcHyd.id, {
    slug: "barrages_archive_hidden",
    name_ar: "أرشيف السدود (مخفي للعرض)",
    name_fr: "Archives barrages (masqué démo)",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "hydraulique-barrages", table_key: "main" },
    hidden_at: now,
  });

  const typeInvCommuneComplex = await createType(svcInv.id, {
    slug: "suivi_communes_complex",
    name_ar: "متابعة المشاريع — ملف البلدية",
    name_fr: "Suivi projets — dossier commune",
    layout_kind: "memo",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    schema_json: null,
  });

  const typeInvDoc = await createType(svcInv.id, {
    slug: "memo_cellule",
    name_ar: "مذكرة الخلية الولائية",
    name_fr: "Mémo cellule wilaya",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "standalone",
    schema_json: null,
  });

  const typeHydFiche = await RapportType.findOne({
    where: { service_id: svcHyd.id, content_kind: "fiche_lecture" },
  });
  const typeInvFiche = await RapportType.findOne({
    where: { service_id: svcInv.id, content_kind: "fiche_lecture" },
  });

  const embeddedHydTableId = crypto.randomUUID();
  const embeddedInvTableId = crypto.randomUUID();
  const embeddedHydFicheTableId = crypto.randomUUID();
  const embeddedInvFicheTableId = crypto.randomUUID();
  const hydCommuneTable1325 = crypto.randomUUID();
  const hydCommuneTable1301 = crypto.randomUUID();
  const invCommuneTable1301 = crypto.randomUUID();
  const invCommuneTable1327 = crypto.randomUUID();

  await createTemplate(svcHyd.id, {
    slug: "hydraulique-distribution-template",
    name_ar: "نموذج توزيع — عين نحالة",
    name_fr: "Modèle distribution — Ain Nehala",
    content_kind: "document_compose",
    typeId: typeHydDoc.id,
    is_default: true,
    content_json: {
      rich_html_ar: `<p>برنامج توزيع المياه — بلدية عين نحالة. يرجى إكمال الجدول أدناه.</p><div data-schema-table-id="${embeddedHydTableId}"></div>`,
      rich_html_fr: `<p>Programme de distribution — commune Ain Nehala. Compléter le tableau ci-dessous.</p><div data-schema-table-id="${embeddedHydTableId}"></div>`,
      embedded_tables: [
        {
          id: embeddedHydTableId,
          schema_slug: "hydraulique-barrages",
          schema_name_ar: "ملخص الشبكة",
          schema_name_fr: "Résumé réseau",
          columns: [
            {
              key: "zone",
              type: "text",
              label_ar: "المنطقة",
              label_fr: "Zone",
            },
            {
              key: "length_km",
              type: "number",
              format: "decimal",
              label_ar: "طول الشبكة (كم)",
              label_fr: "Longueur (km)",
            },
            {
              key: "status",
              type: "text",
              label_ar: "الحالة",
              label_fr: "Statut",
            },
          ],
          layout_json: {},
          table_meta: {
            title_ar: "شبكة التوزيع — عين نحالة",
            title_fr: "Réseau — Ain Nehala",
          },
          rows: [
            rowMeta({
              zone: "الوسط",
              length_km: 12.5,
              status: "جيد",
              _cell_colors: { status: "success" },
            }),
            rowMeta({
              zone: "الضواحي",
              length_km: 8.2,
              status: "يحتاج صيانة",
              _cell_colors: { status: "warning" },
            }),
          ],
          rapport_only: true,
        },
      ],
    },
  });

  await createTemplate(svcInv.id, {
    slug: "investissement-memo-template",
    name_ar: "نموذج مذكرة الخلية",
    name_fr: "Modèle mémo cellule",
    content_kind: "document_compose",
    typeId: typeInvDoc.id,
    is_default: true,
    content_json: {
      rich_html_ar:
        "<p>نتائج أشغال الخلية الولائية المتعلقة بمتابعة تسوية المشاريع الاستثمارية.</p>",
      rich_html_fr:
        "<p>Résultats des travaux de la cellule wilaya — suivi des projets d'investissement.</p>",
      embedded_tables: [
        {
          id: embeddedInvTableId,
          schema_slug: "investissement-projets",
          schema_name_ar: "ملخص",
          schema_name_fr: "Synthèse",
          columns: invCols.slice(0, 4),
          layout_json: {},
          table_meta: {
            title_ar: "ملخص المشاريع",
            title_fr: "Synthèse projets",
          },
          rows: [
            rowMeta({
              project_title: "مصنع تعبئة",
              owner: "شركة SA",
              municipality_code: "1301",
              total_amount: 85000000,
            }),
          ],
          rapport_only: true,
        },
      ],
    },
  });

  for (const svc of [svcHyd, svcInv]) {
    await UserServiceGrant.create({
      user_id: office.id,
      service_id: svc.id,
      access_level: "manage",
    });
  }
  await UserServiceGrant.create({
    user_id: officeView.id,
    service_id: svcHyd.id,
    access_level: "view",
  });

  const hydTableV1 = {
    schema_snapshot: hydSchemaSnap,
    tables: [
      {
        key: "main",
        title_ar: hydBarrageLayout.default_title_ar,
        title_fr: hydBarrageLayout.default_title_fr,
        subtitle_ar: hydBarrageLayout.default_subtitle_ar,
        subtitle_fr: hydBarrageLayout.default_subtitle_fr,
        merge_column_keys: ["dam_name"],
        rows: [
          rowMeta({
            dam_name: "سد تlemcen",
            capacity_m3: 45000000,
            fill_pct: 62,
            alert_level: "normal",
            notes: "وضعية مستقرة",
            _cell_colors: { fill_pct: "info" },
          }),
          rowMeta({
            dam_name: "سد تlemcen",
            capacity_m3: 45000000,
            fill_pct: 58,
            alert_level: "watch",
            notes: "انخفاض طفيف",
            _cell_colors: { fill_pct: "warning", alert_level: "warning" },
          }),
          rowMeta({
            dam_name: "سد بنi بحدل",
            capacity_m3: 12000000,
            fill_pct: 41,
            alert_level: "critical",
            notes: "يتطلب متابعة عاجلة",
            _cell_colors: { fill_pct: "important", alert_level: "important" },
            _row_finished: true,
          }),
        ],
        media_rows: [],
      },
    ],
  };

  const hydTableV2 = JSON.parse(JSON.stringify(hydTableV1));
  hydTableV2.tables[0].rows[2].fill_pct = 44;
  hydTableV2.tables[0].rows[2].notes = "تحسن بعد تدخلات — v2";

  hydTableV1.tables[0].media_rows = [{ items: [] }];

  const hydTableBundle = await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydTable.id,
    title: `حالة السدود — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "changes_requested",
    chefGate: "bypass",
    versions: [
      { number: 1, data_json: hydTableV1, submitted_at: twoDaysAgo },
      { number: 2, data_json: hydTableV2, submitted_at: null },
    ],
    waliResponses: [
      {
        versionNumber: 1,
        decision: "changes_requested",
        body_text: "يرجى تحديث نسب الملء لسد بنi بحدل وإرفاق صور حديثة.",
        waliUserId: wali.id,
        notifyOffice: true,
      },
    ],
    chefResponses: [
      {
        versionNumber: 1,
        decision: "accepted",
        body_text: "مقبول من رئيس الديوان — يُرفع للوالي.",
        chefUserId: chef.id,
        notifyOffice: true,
        messageKey: "chefAccepted",
        created_at: threeDaysAgo,
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "موعد متابعة السدود",
        title_fr: "Échéance suivi barrages",
        note_ar: "عرض على الوالي",
      },
    ],
  });

  await Notification.create({
    user_id: chef.id,
    rapport_id: hydTableBundle.rapport.id,
    message_key: "rapportResubmittedBypass",
    created_at: dayAgo,
  });

  const ainNehalaBlocks = buildCommuneDocumentDefaultBlocks({
    name_ar: "عين نحالة",
    name_fr: "Ain Nehala",
  });
  ainNehalaBlocks.push(
    paragraphBlock(
      "برنامج توزيع المياه — شبكة البلدية. يشمل أعمال الصيانة والتوسيع.",
      "Programme de distribution — réseau communal. Maintenance et extension.",
    ),
    {
      type: "media_row",
      items: [{ file_id: null }],
    },
  );

  const hydDocBundle = await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydDoc.id,
    title: `توزيع المياه — عين نحالة — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "pending_chef",
    chefGate: "required",
    versions: [
      {
        number: 1,
        data_json: {
          blocks: ainNehalaBlocks,
          rich_html_ar: `<p>تقرير توزيع المياه لبلدية عين نحالة.</p><div data-schema-table-id="${embeddedHydTableId}"></div>`,
          rich_html_fr: `<p>Rapport distribution eau — Ain Nehala.</p><div data-schema-table-id="${embeddedHydTableId}"></div>`,
          embedded_tables: [
            {
              id: embeddedHydTableId,
              schema_slug: "hydraulique-barrages",
              schema_name_ar: "شبكة التوزيع",
              schema_name_fr: "Réseau distribution",
              columns: [
                { key: "zone", type: "text", label_ar: "المنطقة", label_fr: "Zone" },
                {
                  key: "length_km",
                  type: "number",
                  format: "decimal",
                  label_ar: "الطول (كم)",
                  label_fr: "Longueur (km)",
                },
                { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
              ],
              layout_json: {},
              table_meta: {
                title_ar: "شبكة عين نحالة",
                title_fr: "Réseau Ain Nehala",
              },
              rows: [
                rowMeta({ zone: "حي المركز", length_km: 6.4, notes: "مكتمل" }),
                rowMeta({
                  zone: "حي الجديد",
                  length_km: 3.1,
                  notes: "قيد الإنجاز",
                  _cell_colors: { notes: "warning" },
                }),
              ],
            },
          ],
        },
        submitted_at: dayAgo,
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "عين نحالة — توزيع",
        title_fr: "Ain Nehala — distribution",
        note_ar: "مذكرة لرئيس الديوان",
      },
    ],
  });

  const hydCommuneBundle = await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydCommune.id,
    title: `متابعة التوزيع — بلديات (ملف مركّب) — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    chefGate: "required",
    versions: [
      {
        number: 1,
        data_json: {
          communes: {
            "1325": buildCommuneComplexEntry(
              { name_ar: "عين نحالة", name_fr: "Ain Nehala" },
              {
                tableId: hydCommuneTable1325,
                introAr: "برنامج توزيع المياه — شبكة بلدية عين نحالة.",
                introFr: "Programme de distribution — réseau communal Ain Nehala.",
                extraBlocks: [
                  paragraphBlock(
                    "مرجع: توزيع المياه — تشمل الشبكة الرئيسية والفرعية.",
                    "Réf. distribution eau — réseau principal et secondaire.",
                  ),
                ],
                table: communeStatusTable(
                  hydCommuneTable1325,
                  "ملخص شبكة التوزيع",
                  "Résumé réseau distribution",
                  [
                    rowMeta({
                      label: "طول الشبكة (كم)",
                      value: "18.4",
                      _cell_colors: { value: "info" },
                    }),
                    rowMeta({
                      label: "نسبة التغطية",
                      value: "92%",
                      _cell_colors: { value: "success" },
                    }),
                    rowMeta({
                      label: "أعمال جارية",
                      value: "توسيع حي الجديد",
                      _cell_colors: { value: "warning" },
                    }),
                  ],
                ),
                calendar_events: [
                  {
                    event_date: weekAnchor,
                    title_ar: "زيارة ميدانية — عين نحالة",
                    title_fr: "Visite terrain — Ain Nehala",
                  },
                ],
              },
            ),
            "1301": buildCommuneComplexEntry(
              { name_ar: "تلمسان", name_fr: "Tlemcen" },
              {
                tableId: hydCommuneTable1301,
                introAr: "مركز الولاية — ضغط شبكة المياه.",
                introFr: "Chef-lieu — pression du réseau.",
                extraBlocks: [
                  paragraphBlock(
                    "نقاط ضغط منخفض في بعض الأحياء — متابعة مستمرة.",
                    "Points de basse pression — suivi continu.",
                  ),
                ],
                table: communeStatusTable(
                  hydCommuneTable1301,
                  "مؤشرات الشبكة",
                  "Indicateurs réseau",
                  [
                    rowMeta({ label: "الضغط (bar)", value: "3.2" }),
                    rowMeta({
                      label: "الحالة",
                      value: "مراقبة",
                      _cell_colors: { value: "warning" },
                    }),
                  ],
                ),
              },
            ),
            "1307": buildCommuneComplexEntry(
              { name_ar: "الغزوات", name_fr: "Ghazaouet" },
              {
                introAr: "منطقة ساحلية — شبكة توزيع محدودة.",
                introFr: "Zone côtière — réseau de distribution limité.",
                extraBlocks: [
                  paragraphBlock(
                    "مشروع تمديد قيد الدراسة.",
                    "Projet de extension en étude.",
                  ),
                ],
              },
            ),
          },
        },
        submitted_at: dayAgo,
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "متابعة التوزيع — بلديات",
        title_fr: "Suivi distribution — communes",
        note_ar: "ملف مركّب لكل بلدية",
      },
    ],
  });

  await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydFiche.id,
    title: `مذكرة استخلاصية — الموارد المائية — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "acknowledged",
    versions: [
      {
        number: 1,
        data_json: buildHydFicheDataJson(embeddedHydFicheTableId),
        submitted_at: twoDaysAgo,
      },
    ],
    waliResponses: [
      {
        versionNumber: 1,
        decision: "accepted",
        follow_up_status: "pending",
        body_text: "مقبول — تنفيذ أعمال الصيانة لسد بني بهدل قبل نهاية الربع.",
        waliUserId: wali.id,
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "مذكرة استخلاصية — الموارد المائية",
        title_fr: "Fiche lecture — hydraulique",
        note_ar: "عرض على الوالي — السدود والتوزيع",
      },
    ],
  });

  const invTableV1 = {
    schema_snapshot: invSchemaSnap,
    tables: [
      {
        key: "main",
        title_ar: invLayout.default_title_ar,
        title_fr: invLayout.default_title_fr,
        subtitle_ar: invLayout.default_subtitle_ar,
        subtitle_fr: invLayout.default_subtitle_fr,
        merge_column_keys: ["project_title"],
        rows: [
          rowMeta({
            project_title: "مجمع صناعي — مغنية",
            owner: "Groupe Maghnia SA",
            municipality_code: "1327",
            total_amount: 120000000,
            completion_pct: 75,
            notes: "في طور الإنجاز",
            _cell_colors: { completion_pct: "success" },
          }),
          rowMeta({
            project_title: "فندق — تlemسان",
            owner: "SARL Tourisme",
            municipality_code: "1301",
            total_amount: 45000000,
            completion_pct: 35,
            notes: "تأخر في التراخيص",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
          rowMeta({
            project_title: "محطة تعبئة — عين نحالة",
            owner: "Hydrocarbures Ouest",
            municipality_code: "1325",
            total_amount: 28000000,
            completion_pct: 90,
            notes: "شبه منجز",
            _cell_colors: { completion_pct: "info" },
            _row_finished: true,
          }),
        ],
      },
    ],
  };

  const invTableBundle = await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvTable.id,
    title: `تسوية المشاريع — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "under_review",
    chefGate: "required",
    versions: [
      { number: 1, data_json: invTableV1, submitted_at: dayAgo },
    ],
    chefResponses: [
      {
        versionNumber: 1,
        decision: "accepted",
        body_text: "مراجعة أولية مكتملة — جاهز لمكتب الوالي.",
        chefUserId: chef.id,
        notifyOffice: true,
        messageKey: "chefAccepted",
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "جلسة الخلية الولائية",
        title_fr: "Session cellule wilaya",
        note_ar: "عرض جدول المشاريع",
      },
    ],
  });

  const communeKey1301 = entityKey("commune", "1301");
  const communeKey1327 = entityKey("commune", "1327");
  const dairaKey1301 = entityKey("daira", "1301");
  const directionKeyDir02 = entityKey("direction", dirInv.code);

  const invListeV1Entities = {
    [communeKey1301]: {
      rows: [
        rowMeta({
          project_title: "فندق تlemسان",
          owner: "SARL Tourisme",
          municipality_code: "1301",
          total_amount: 45000000,
          completion_pct: 35,
          notes: "قيد الدراسة",
        }),
      ],
    },
    [communeKey1327]: {
      rows: [
        rowMeta({
          project_title: "مجمع صناعي",
          owner: "Groupe Maghnia",
          municipality_code: "1327",
          total_amount: 120000000,
          completion_pct: 75,
          notes: "إنجاز جيد",
          _cell_colors: { completion_pct: "success" },
        }),
      ],
    },
    [dairaKey1301]: {
      rows: [
        rowMeta({
          project_title: "تجميع دائرة تلمسان",
          owner: "ولاية تلمسان",
          municipality_code: "1301",
          total_amount: 15000000,
          completion_pct: 50,
          notes: "مستوى الدائرة",
        }),
      ],
    },
    [directionKeyDir02]: {
      rows: [
        rowMeta({
          project_title: "متابعة مديرية الاستثمار",
          owner: dirInv.name_ar,
          municipality_code: "1301",
          total_amount: 8000000,
          completion_pct: 20,
          notes: "مؤشرات المديرية",
        }),
      ],
    },
  };

  const invListeV2Entities = JSON.parse(JSON.stringify(invListeV1Entities));
  invListeV2Entities[communeKey1301].rows[0].completion_pct = 42;
  invListeV2Entities[communeKey1301].rows[0].notes = "تحديث بعد جلسة الخلية — v2";
  invListeV2Entities[directionKeyDir02].rows[0].completion_pct = 35;
  invListeV2Entities[directionKeyDir02].rows[0].notes = "تقدم المديرية — v2";

  const invListeIncluded = [communeKey1301, communeKey1327, dairaKey1301, directionKeyDir02];

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvCommune.id,
    title: `المشاريع حسب البلدية / الدائرة / المديرية — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    chefGate: "required",
    versions: [
      {
        number: 1,
        data_json: {
          communes: {
            "1301": invListeV1Entities[communeKey1301],
            "1327": invListeV1Entities[communeKey1327],
          },
          entities: invListeV1Entities,
          included_entity_keys: invListeIncluded,
          schema_snapshot: invSchemaSnap,
        },
        submitted_at: twoDaysAgo,
      },
      {
        number: 2,
        data_json: {
          communes: {
            "1301": invListeV2Entities[communeKey1301],
            "1327": invListeV2Entities[communeKey1327],
          },
          entities: invListeV2Entities,
          included_entity_keys: invListeIncluded,
          schema_snapshot: invSchemaSnap,
        },
        changed_entity_keys: [communeKey1301, directionKeyDir02],
        changed_commune_codes: ["1301"],
        submitted_at: dayAgo,
      },
    ],
  });

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvCommuneComplex.id,
    title: `متابعة المشاريع — ملفات البلديات — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    chefGate: "required",
    hiddenAt: now,
    versions: [
      {
        number: 1,
        data_json: {
          communes: {
            "1301": buildCommuneComplexEntry(
              { name_ar: "تلمسان", name_fr: "Tlemcen" },
              {
                tableId: invCommuneTable1301,
                introAr: "مشروع فندقي — متابعة تسوية المشاريع الاستثمارية.",
                introFr: "Projet hôtelier — suivi investissement.",
                extraBlocks: [
                  paragraphBlock(
                    "تأخر في التراخيص — اللجنة الولائية قيد المتابعة.",
                    "Retard autorisations — cellule wilaya en suivi.",
                  ),
                ],
                table: communeStatusTable(
                  invCommuneTable1301,
                  "بيانات المشروع",
                  "Données projet",
                  [
                    rowMeta({
                      label: "المبلغ (دج)",
                      value: "45 000 000",
                      _cell_colors: { value: "info" },
                    }),
                    rowMeta({
                      label: "نسبة الإنجاز",
                      value: "35%",
                      _cell_colors: { value: "warning" },
                    }),
                    rowMeta({ label: "صاحب المشروع", value: "SARL Tourisme" }),
                  ],
                ),
                calendar_events: [
                  {
                    event_date: weekAnchor,
                    title_ar: "جلسة متابعة — تلمسان",
                    title_fr: "Session suivi — Tlemcen",
                  },
                ],
              },
            ),
            "1327": buildCommuneComplexEntry(
              { name_ar: "مغنية", name_fr: "Maghnia" },
              {
                tableId: invCommuneTable1327,
                introAr: "مجمع صناعي — نسبة إنجاز متقدمة.",
                introFr: "Complexe industriel — avancement élevé.",
                table: communeStatusTable(
                  invCommuneTable1327,
                  "مؤشرات المشروع",
                  "Indicateurs projet",
                  [
                    rowMeta({
                      label: "المبلغ (دج)",
                      value: "120 000 000",
                      _cell_colors: { value: "success" },
                    }),
                    rowMeta({ label: "نسبة الإنجاز", value: "75%" }),
                  ],
                ),
              },
            ),
            "1325": buildCommuneComplexEntry(
              { name_ar: "عين نحالة", name_fr: "Ain Nehala" },
              {
                introAr: "محطة تعبئة — شبه منجز.",
                introFr: "Station-service — quasi achevé.",
                extraBlocks: [
                  paragraphBlock(
                    "في انتظار التسليم النهائي.",
                    "En attente de réception définitive.",
                  ),
                ],
              },
            ),
          },
        },
        submitted_at: dayAgo,
      },
    ],
  });

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvDoc.id,
    title: `مذكرة الخلية — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "draft",
    versions: [
      {
        number: 1,
        data_json: {
          blocks: buildOfficialHeaderBlocks().concat([
            headingBlock("مذكرة الخلية الولائية", "Mémo cellule wilaya"),
            paragraphBlock(
              "ملخص أشغال متابعة تسوية المشاريع الاستثمارية.",
              "Synthèse suivi projets investissement.",
            ),
          ]),
          rich_html_ar: `<p>الخلية الولائية — دورة 2026.</p>`,
          rich_html_fr: `<p>Cellule wilaya — session 2026.</p>`,
        },
      },
    ],
  });

  const invFicheBundle = await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvFiche.id,
    title: `مذكرة استخلاصية — تسوية المشاريع — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    chefGate: "required",
    versions: [
      {
        number: 1,
        data_json: buildInvFicheDataJson(embeddedInvFicheTableId),
        submitted_at: dayAgo,
      },
    ],
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "مذكرة استخلاصية — استثمار",
        title_fr: "Fiche lecture — investissement",
        note_ar: "للتوقيع — خلية ولائية 2026",
      },
    ],
  });

  // --- Org soft-hide samples (admin restore demo) ---
  const dairaHide = await Daira.findOne({ where: { code: "1351" } });
  if (dairaHide) await dairaHide.update({ hidden_at: now });
  const communeHide = await Municipality.findOne({ where: { code: "1344" } });
  if (communeHide) await communeHide.update({ hidden_at: now });
  if (dirUrban) await dirUrban.update({ hidden_at: now });

  // --- Discussion thread (office ↔ chef ↔ wali) ---
  const discussionRapport = invTableBundle.rapport;
  const discussionVersion = invTableBundle.versions[0];
  const commentOffice = await RapportComment.create({
    rapport_id: discussionRapport.id,
    author_user_id: office.id,
    rapport_version_id: discussionVersion.id,
    body_text: "نرجو توضيح موقف المشروع الفندقي قبل الجلسة.",
    created_at: dayAgo,
  });
  const commentChef = await RapportComment.create({
    rapport_id: discussionRapport.id,
    author_user_id: chef.id,
    rapport_version_id: discussionVersion.id,
    body_text: "تمت المراجعة الأولية — في انتظار ملاحظة الوالي.",
    created_at: new Date(dayAgo.getTime() + 3600000),
  });
  const commentWali = await RapportComment.create({
    rapport_id: discussionRapport.id,
    author_user_id: wali.id,
    rapport_version_id: discussionVersion.id,
    body_text: "يرجى إرفاق محضر الخلية مع النسخة القادمة.",
    created_at: now,
  });
  for (const [userId, commentId] of [
    [chef.id, commentOffice.id],
    [wali.id, commentOffice.id],
    [office.id, commentChef.id],
    [wali.id, commentChef.id],
    [office.id, commentWali.id],
    [chef.id, commentWali.id],
  ]) {
    await Notification.create({
      user_id: userId,
      rapport_id: discussionRapport.id,
      comment_id: commentId,
      message_key: "rapportComment",
      created_at: now,
    });
  }

  // Extra discussion unread on hyd commune (submitted — visible to Wali)
  const c2 = await RapportComment.create({
    rapport_id: hydCommuneBundle.rapport.id,
    author_user_id: office.id,
    rapport_version_id: hydCommuneBundle.versions[0].id,
    body_text: "ملف البلديات جاهز للمناقشة.",
    created_at: dayAgo,
  });
  await Notification.create({
    user_id: chef.id,
    rapport_id: hydCommuneBundle.rapport.id,
    comment_id: c2.id,
    message_key: "rapportComment",
    created_at: dayAgo,
  });
  await Notification.create({
    user_id: wali.id,
    rapport_id: hydCommuneBundle.rapport.id,
    comment_id: c2.id,
    message_key: "rapportComment",
    created_at: dayAgo,
  });

  // --- Wali instructions ---
  const instrAll = await WaliInstruction.create({
    title_ar: "تعليمة عامة — مواعيد التقارير الأسبوعية",
    title_fr: "Instruction générale — échéances hebdomadaires",
    body_ar: "يرجى احترام موعد إرسال التقارير كل يوم أحد قبل الساعة 12.",
    body_fr: "Respecter l'envoi des rapports chaque dimanche avant 12h.",
    created_by_user_id: wali.id,
    created_at: dayAgo,
    updated_at: dayAgo,
  });
  for (const uid of [office.id, officeView.id]) {
    await WaliInstructionRecipient.create({
      instruction_id: instrAll.id,
      user_id: uid,
      read_at: null,
      created_at: dayAgo,
    });
    await Notification.create({
      user_id: uid,
      instruction_id: instrAll.id,
      message_key: "waliInstruction",
      created_at: dayAgo,
    });
  }

  const instrOne = await WaliInstruction.create({
    title_ar: "تعليمة خاصة — مصلحة المياه",
    title_fr: "Instruction ciblée — hydraulique",
    body_ar: "تحديث نسب ملء السدود قبل زيارة السيد الوالي.",
    body_fr: "Mettre à jour les taux de remplissage avant la visite du Wali.",
    created_by_user_id: wali.id,
    created_at: now,
    updated_at: now,
  });
  await WaliInstructionRecipient.create({
    instruction_id: instrOne.id,
    user_id: office.id,
    read_at: null,
    created_at: now,
  });
  await Notification.create({
    user_id: office.id,
    instruction_id: instrOne.id,
    message_key: "waliInstruction",
    created_at: now,
  });

  // --- Broadcast (office + chef) ---
  const imageFiles = listUploadFiles([".png", ".jpg", ".jpeg"]);
  const videoFiles = listUploadFiles([".mp4", ".webm", ".mov"]);
  let broadcastSeeded = false;
  if (imageFiles.length > 0) {
    const img = imageFiles[0];
    const stem = path.parse(img.name).name;
    const broadcastFile = await registerUploadedFile({
      storageKey: stem,
      originalName: img.name,
      mimeType: img.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      sizeBytes: img.size,
      mediaKind: "image",
      uploadedByUserId: wali.id,
    });
    await broadcastFile.update({ storage_rel_path: `uploads/${img.name}` });

    const broadcast = await WaliBroadcast.create({
      uploaded_file_id: broadcastFile.id,
      title_ar: "مشاركة ملف — اجتماع الولاية",
      title_fr: "Partage — réunion wilaya",
      message_ar: "وثيقة مرفقة للاطلاع — مكتب الوالي.",
      message_fr: "Document joint pour information — cabinet du Wali.",
      allow_comments: true,
      created_by_user_id: wali.id,
      created_at: dayAgo,
    });
    for (const uid of [office.id, chef.id]) {
      await WaliBroadcastRecipient.create({
        broadcast_id: broadcast.id,
        user_id: uid,
        read_at: null,
        created_at: dayAgo,
      });
      await Notification.create({
        user_id: uid,
        broadcast_id: broadcast.id,
        message_key: "waliBroadcast",
        created_at: dayAgo,
      });
    }
    await WaliBroadcastComment.create({
      broadcast_id: broadcast.id,
      user_id: office.id,
      body_text: "تم الاستلام — شكراً.",
      created_at: now,
    });
    broadcastSeeded = true;
  } else {
    console.warn("No image in storage/uploads — skipped Wali broadcast seed.");
  }

  // --- Guide videos ---
  let guideCount = 0;
  if (videoFiles.length > 0) {
    const audiences = [
      { audience: "general", title_ar: "دليل عام للمنصة", title_fr: "Guide général", is_new: true },
      { audience: "OFFICE_USER", title_ar: "دليل مكتب المصلحة", title_fr: "Guide bureau", is_new: false },
      { audience: "CHEF_CABINET", title_ar: "دليل رئيس الديوان", title_fr: "Guide chef cabinet", is_new: false },
      { audience: "WALI", title_ar: "دليل حساب الوالي", title_fr: "Guide wali", is_new: false },
      { audience: "ADMIN", title_ar: "دليل المسؤول (سري)", title_fr: "Guide admin (secret)", is_new: false },
    ];
    for (let i = 0; i < audiences.length; i++) {
      const vf = videoFiles[Math.min(i, videoFiles.length - 1)];
      const fileRow = await registerUploadedFile({
        storageKey: `guidedemo${i}${path.parse(vf.name).name}`.slice(0, 64),
        originalName: vf.name,
        mimeType: "video/mp4",
        sizeBytes: vf.size,
        mediaKind: "video",
        uploadedByUserId: admin.id,
      });
      await fileRow.update({ storage_rel_path: `uploads/${vf.name}` });
      await GuideVideo.create({
        title_ar: audiences[i].title_ar,
        title_fr: audiences[i].title_fr,
        description_ar: "فيديو تجريبي للعرض",
        description_fr: "Vidéo de démonstration",
        audience: audiences[i].audience,
        uploaded_file_id: fileRow.id,
        is_new: audiences[i].is_new,
        sort_order: i,
        created_by_user_id: admin.id,
        created_at: now,
        updated_at: now,
      });
      guideCount += 1;
    }
  } else {
    console.warn("No video in storage/uploads — skipped guide videos seed.");
  }

  void hydDocBundle;
  void invFicheBundle;
  void dirHyd;

  console.log("\n=== Demo presentation seed complete ===\n");
  console.log("Password (all demo users):", TEST_PASSWORD);
  console.log("\nLogins:");
  console.log(`  admin     — compte admin     (${admin.username})`);
  console.log("  office1   — compte bureau (Éditeur / manage)");
  console.log("  office2   — compte bureau (Lecture / view Hydraulique)");
  console.log("  chef1     — رئيس الديوان");
  console.log("  wali1     — compte wali");
  console.log("\nDepartments / services:");
  console.log(`  [${deptHyd.id}] ${deptHyd.name_ar} → hydraulique`);
  console.log(`  [${deptInv.id}] ${deptInv.name_ar} → investissement`);
  console.log("\nDirections seeded: DIR01, DIR02, DIR03 (DIR03 soft-hidden)");
  console.log("\nStatus matrix:");
  console.log("  pending_chef      — توزيع المياه (Chef inbox)");
  console.log("  submitted         — قائمة مختلطة + مذكرة استخلاصية استثمار (return-to-draft)");
  console.log("  under_review      — تسوية المشاريع + discussion");
  console.log("  changes_requested — حالة السدود (chef_gate=bypass)");
  console.log("  acknowledged      — مذكرة استخلاصية موارد مائية");
  console.log("  draft             — مذكرة الخلية");
  console.log("  hidden rapport    — متابعة المشاريع ملفات البلديات");
  console.log("\nAlso seeded:");
  console.log("  • Liste targets: commune + daira + direction + changed_entity_keys");
  console.log("  • Soft-hide: daira 1351, commune 1344, direction DIR03, type barrages_archive_hidden");
  console.log("  • Instructions (all + office1) | Broadcast office+chef:", broadcastSeeded ? "yes" : "no");
  console.log("  • Guide videos:", guideCount);
  console.log("  • Discussion comments + unread notifs (office / chef / wali)");
  console.log("\nDemo script tips:");
  console.log("  chef1  → inbox pending_chef + /chef/shared + instructions (read-only)");
  console.log("  wali1  → inbox (no pending_chef) + instructions + broadcast + discussion New");
  console.log("  office1→ return-to-draft on submitted/under_review; guide videos; hide restore");
  console.log("  office2→ view-only Hydraulique");
  console.log("  admin  → org soft-hide restore + guide ADMIN video + schemas");
  console.log("\nRe-run: npm run db:seed-demo\n");
}

async function main() {
  try {
    await sequelize.authenticate();
    await clearAllDomain();
    await seedDemo();
  } catch (err) {
    console.error(err.stack || err.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
