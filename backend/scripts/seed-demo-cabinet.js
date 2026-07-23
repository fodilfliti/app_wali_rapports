"use strict";

/**
 * Demo 2 — fill cabinet bootstrap services with presentation data (DEV ONLY).
 *
 * Prerequisites: run prod bootstrap first (users + root leaf services exist).
 * Does NOT delete users/services/grants. Clears rapports + types/schemas then reseeds.
 *
 * Hero services (full Demo 1 depth): svc-chabira-eau, svc-zaabat-invest (flat root leaves).
 * Other services: lightweight generic fill.
 *
 * Usage:
 *   npm run db:seed-demo-cabinet
 *
 * Refuses when NODE_ENV=production.
 */

require("./load-env");

const {
  sequelize,
  User,
  Service,
  RapportType,
  RapportTableSchema,
  RapportDocumentTemplate,
  Rapport,
  RapportVersion,
  WaliResponse,
  ChefResponse,
  Notification,
  RapportCalendarEvent,
  RapportComment,
  WaliInstruction,
  WaliInstructionRecipient,
  WaliBroadcast,
  WaliBroadcastRecipient,
  UploadedFile,
  Municipality,
} = require("../src/db");

const inventory = require("./data/prodBootstrapInventory");
const {
  buildFicheDefaultBlocks,
  buildFicheDefaultDataJson,
  buildDocumentDefaultDataJson,
} = require("../src/modules/rapports/documentDefaults");
const { seedHeroIfNeeded } = require("./lib/seedCabinetHeroes");
const {
  createRapportSeed,
  createVersionSeed,
  setRapportCurrentVersion,
  createNotificationSeed,
} = require("./lib/seedIdentity");
const { appendAfterLetterhead } = require("./lib/demoPresentationData");

function assertDevOnly() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing: db:seed-demo-cabinet is DEV ONLY (NODE_ENV=production).");
    process.exit(1);
  }
}

function rowMeta(overrides = {}) {
  return {
    _row_finished: false,
    _wali_visible: true,
    _highlight: "none",
    _cell_colors: {},
    ...overrides,
  };
}

async function clearPresentationData() {
  console.log("Clearing presentation data (keeping users + services)...");
  await sequelize.query("UPDATE rapports SET current_version_id = NULL");
  const tables = [
    "notifications",
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
    "rapport_document_templates",
    "rapport_types",
    "rapport_table_schemas",
  ];
  for (const table of tables) {
    try {
      await sequelize.query(`DELETE FROM ${table}`);
    } catch (err) {
      if (String(err.message || "").includes("does not exist")) continue;
      throw err;
    }
  }
  console.log("Cleared.");
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
  waliResponses = [],
  chefResponses = [],
  calendarEvents = [],
}) {
  const rapport = await createRapportSeed({
    service_id: serviceId,
    rapport_type_id: typeId,
    title,
    status: "draft",
    chef_gate: chefGate,
    created_by_user_id: authorId,
    owner_office_user_id: ownerId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const versionRows = [];
  for (const v of versions) {
    const row = await createVersionSeed(
      {
        version_number: v.number,
        data_json: v.data_json,
        submitted_at: v.submitted_at || null,
        created_by_user_id: authorId,
        created_at: v.submitted_at || new Date(),
      },
      rapport,
    );
    versionRows.push(row);
  }

  const current = versionRows[versionRows.length - 1];
  await setRapportCurrentVersion(rapport, current, { status });

  for (const wr of waliResponses) {
    const resp = await WaliResponse.create({
      rapport_id: rapport.id,
      rapport_version_id: wr.versionId || current.id,
      decision: wr.decision,
      follow_up_status: wr.follow_up_status || "none",
      body_text: wr.body_text || "",
      scope: "whole_rapport",
      created_by_user_id: wr.authorId,
    });
    if (wr.notifyUserId) {
      await createNotificationSeed({
        user_id: wr.notifyUserId,
        rapport_id: rapport.id,
        wali_response_id: resp.id,
        message_key: wr.message_key || "waliFeedback",
      });
    }
  }

  for (const cr of chefResponses) {
    const resp = await ChefResponse.create({
      rapport_id: rapport.id,
      rapport_version_id: cr.versionId || current.id,
      decision: cr.decision,
      follow_up_status: "none",
      body_text: cr.body_text || "",
      scope: "whole_rapport",
      created_by_user_id: cr.authorId,
    });
    if (cr.notifyUserId) {
      await createNotificationSeed({
        user_id: cr.notifyUserId,
        rapport_id: rapport.id,
        chef_response_id: resp.id,
        message_key: cr.message_key || "chefFeedback",
      });
    }
  }

  for (const ev of calendarEvents) {
    await RapportCalendarEvent.create({
      rapport_id: rapport.id,
      event_date: ev.event_date,
      title_ar: ev.title_ar,
      title_fr: ev.title_fr || ev.title_ar,
      note_ar: ev.note_ar || null,
      note_fr: ev.note_fr || null,
      created_by_user_id: authorId,
    });
  }

  return { rapport, versions: versionRows };
}

function ficheHtml(serviceName, bodyAr) {
  const base = buildFicheDefaultDataJson();
  return {
    ...base,
    rich_html_ar: appendAfterLetterhead(
      base.rich_html_ar,
      `<p>${bodyAr}</p><p>ولاية تلمسان — الديوان — عرض تقديمي.</p>`,
    ),
    rich_html_fr: appendAfterLetterhead(
      base.rich_html_fr,
      `<p>Données de démonstration — ${serviceName}.</p>`,
    ),
  };
}

function docHtml(serviceName) {
  const base = buildDocumentDefaultDataJson({
    titleAr: serviceName,
    titleFr: serviceName,
  });
  return {
    ...base,
    rich_html_ar: appendAfterLetterhead(
      base.rich_html_ar,
      `<p>ملف مركّب للمتابعة الأسبوعية. يتضمن ملخص الوضعية والتوصيات.</p><ul><li>متابعة ميدانية</li><li>تنسيق مع المصالح</li><li>آجال الإنجاز</li></ul>`,
    ),
    rich_html_fr: appendAfterLetterhead(
      base.rich_html_fr,
      `<p>Document de suivi hebdomadaire (démo).</p>`,
    ),
    embedded_tables: [],
  };
}

function tableData(schemaSnap, serviceName) {
  return {
    schema_snapshot: schemaSnap,
    tables: [
      {
        key: "main",
        title_ar: `متابعة — ${serviceName}`,
        title_fr: `Suivi — ${serviceName}`,
        subtitle_ar: "بيانات توضيحية لولاية تلمسان",
        subtitle_fr: "Données illustratives — Wilaya de Tlemcen",
        merge_column_keys: [],
        rows: [
          rowMeta({
            item: "مشروع أ",
            status: "جارٍ",
            note: "في الآجال",
            _cell_colors: { status: "success" },
          }),
          rowMeta({
            item: "مشروع ب",
            status: "متأخر",
            note: "يحتاج تدخلاً",
            _cell_colors: { status: "warning" },
          }),
          rowMeta({
            item: "مشروع ج",
            status: "مكتمل",
            note: "تم التسليم",
            _cell_colors: { status: "success" },
          }),
        ],
      },
    ],
  };
}

async function seedService(svc, owner, chef, wali, idx, municipalities) {
  const nameAr = svc.name_ar;
  const slugBase = svc.slug.replace(/^svc-/, "").slice(0, 40);

  const schema = await RapportTableSchema.create({
    service_id: svc.id,
    slug: `schema-${slugBase}`.slice(0, 80),
    name_ar: `جدول متابعة — ${nameAr}`,
    name_fr: `Suivi — ${nameAr}`,
    columns_json: [
      { key: "item", type: "text", label_ar: "العنصر", label_fr: "Élément" },
      { key: "status", type: "text", label_ar: "الحالة", label_fr: "Statut" },
      { key: "note", type: "text", label_ar: "ملاحظة", label_fr: "Note" },
    ],
    layout_json: {},
    is_system: false,
  });

  const schemaSnap = {
    columns: schema.columns_json,
    layout_json: schema.layout_json,
  };

  const typeFiche = await RapportType.create({
    service_id: svc.id,
    slug: "fiche_lecture",
    name_ar: "مذكرة استخلاصية",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: { default_blocks: buildFicheDefaultBlocks() },
  });

  const typeDoc = await RapportType.create({
    service_id: svc.id,
    slug: "document_compose",
    name_ar: "ملف مركّب",
    name_fr: "Document composé",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "versioned",
    schema_json: {},
  });

  const typeTable = await RapportType.create({
    service_id: svc.id,
    slug: "table_grid",
    name_ar: "جدول المتابعة",
    name_fr: "Tableau de suivi",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: schema.slug },
  });

  await RapportDocumentTemplate.create({
    service_id: svc.id,
    rapport_type_id: typeDoc.id,
    rapport_type_ids: [typeDoc.id],
    slug: `tpl-doc-${slugBase}`.slice(0, 80),
    name_ar: "نموذج ملف",
    name_fr: "Modèle document",
    content_kind: "document_compose",
    is_default: true,
    content_json: docHtml(nameAr),
  });

  const now = new Date();
  const day = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  // Fiche → pending chef or submitted cycle
  const ficheStatus = idx % 3 === 0 ? "pending_chef" : idx % 3 === 1 ? "submitted" : "acknowledged";
  await createRapportBundle({
    serviceId: svc.id,
    typeId: typeFiche.id,
    title: `مذكرة — ${nameAr}`,
    ownerId: owner.id,
    authorId: owner.id,
    status: ficheStatus,
    chefGate: "required",
    versions: [
      {
        number: 1,
        submitted_at: now,
        data_json: ficheHtml(
          nameAr,
          `تتعلق هذه المذكرة بمتابعة ملف «${nameAr}» على مستوى ولاية تلمسان، مع اقتراح إجراءات عملية وتنسيق مع المصالح المعنية.`,
        ),
      },
    ],
    chefResponses:
      ficheStatus === "submitted" || ficheStatus === "acknowledged"
        ? [
            {
              decision: "accepted",
              body_text: "موافق للإحالة إلى السيد الوالي.",
              authorId: chef.id,
              notifyUserId: owner.id,
              message_key: "chefAccepted",
            },
          ]
        : [],
    waliResponses:
      ficheStatus === "acknowledged"
        ? [
            {
              decision: "accepted",
              body_text: "اطلعتُ على المذكرة. مواصلة المتابعة.",
              authorId: wali.id,
              notifyUserId: owner.id,
              message_key: "waliAccepted",
            },
          ]
        : [],
    calendarEvents: [
      {
        event_date: day(idx % 5 === 0 ? 0 : 1),
        title_ar: `متابعة ${nameAr}`,
        title_fr: `Suivi ${nameAr}`,
        note_ar: "موعد في تقويم الوالي / رئيس الديوان",
      },
    ],
  });

  // Document → changes_requested sample every 4th service
  const docStatus = idx % 4 === 0 ? "changes_requested" : "draft";
  const docBundle = await createRapportBundle({
    serviceId: svc.id,
    typeId: typeDoc.id,
    title: `ملف مركّب — ${nameAr}`,
    ownerId: owner.id,
    authorId: owner.id,
    status: docStatus,
    chefGate: docStatus === "changes_requested" ? "bypass" : "required",
    versions:
      docStatus === "draft"
        ? [{ number: 1, data_json: docHtml(nameAr) }]
        : [
            {
              number: 1,
              submitted_at: now,
              data_json: docHtml(nameAr),
            },
          ],
    waliResponses:
      docStatus === "changes_requested"
        ? [
            {
              decision: "changes_requested",
              body_text: "يرجى استكمال الأرقام وإضافة توصية واضحة قبل إعادة الإرسال.",
              authorId: wali.id,
              notifyUserId: owner.id,
              message_key: "waliChangesRequested",
            },
          ]
        : [],
  });

  if (docStatus !== "draft") {
    await RapportComment.create({
      rapport_id: docBundle.rapport.id,
      author_user_id: wali.id,
      body_text: `تعليق توضيحي على ملف «${nameAr}» — جاهز للنقاش.`,
      rapport_version_id: docBundle.versions[0].id,
    });
    await Notification.create({
      user_id: owner.id,
      rapport_id: docBundle.rapport.id,
      message_key: "rapportComment",
    });
    await Notification.create({
      user_id: chef.id,
      rapport_id: docBundle.rapport.id,
      message_key: "rapportComment",
    });
  }

  // Table → submitted
  await createRapportBundle({
    serviceId: svc.id,
    typeId: typeTable.id,
    title: `جدول — ${nameAr}`,
    ownerId: owner.id,
    authorId: owner.id,
    status: "under_review",
    chefGate: "bypass",
    versions: [
      {
        number: 1,
        submitted_at: now,
        data_json: tableData(schemaSnap, nameAr),
      },
    ],
  });

  // Commune list on a few services only
  if (idx % 7 === 0 && municipalities.length >= 2) {
    const typeList = await RapportType.create({
      service_id: svc.id,
      slug: "commune_list",
      name_ar: "قائمة البلديات",
      name_fr: "Liste communes",
      layout_kind: "grid",
      content_kind: "commune_list",
      versioning_mode: "versioned",
      commune_content_kind: "table",
      entity_target_kinds: ["commune"],
      schema_json: { table_schema_slug: schema.slug },
    });
    const m0 = municipalities[0];
    const m1 = municipalities[1];
    await createRapportBundle({
      serviceId: svc.id,
      typeId: typeList.id,
      title: `قائمة بلديات — ${nameAr}`,
      ownerId: owner.id,
      authorId: owner.id,
      status: "submitted",
      chefGate: "bypass",
      versions: [
        {
          number: 1,
          submitted_at: now,
          data_json: {
            entities: {
              [`commune:${m0.code}`]: {
                name_ar: m0.name_ar,
                name_fr: m0.name_fr,
                rows: [rowMeta({ item: "تدخل 1", status: "جارٍ", note: "—" })],
              },
              [`commune:${m1.code}`]: {
                name_ar: m1.name_ar,
                name_fr: m1.name_fr,
                rows: [rowMeta({ item: "تدخل 1", status: "مكتمل", note: "—" })],
              },
            },
            schema_snapshot: schemaSnap,
          },
        },
      ],
    });
  }
}

async function main() {
  assertDevOnly();
  await sequelize.authenticate();

  const officeUsernames = inventory.officeUsers.map((o) => o.username);
  const offices = await User.findAll({
    where: { username: officeUsernames, role: "OFFICE_USER" },
  });
  if (offices.length < inventory.officeUsers.length) {
    console.error(
      "Bootstrap users missing. Run first:\n  npm run db:seed-prod-bootstrap",
    );
    process.exit(1);
  }
  const byUsername = Object.fromEntries(offices.map((u) => [u.username, u]));

  const wali = await User.findOne({ where: { username: "wali", role: "WALI" } });
  const chef = await User.findOne({
    where: { username: "chef_cabinet", role: "CHEF_CABINET" },
  });
  if (!wali || !chef) {
    console.error("Missing wali / chef_cabinet — run prod bootstrap first.");
    process.exit(1);
  }

  await clearPresentationData();

  const municipalities = await Municipality.findAll({
    order: [["code", "ASC"]],
    limit: 8,
  });

  let svcIndex = 0;
  for (const officer of inventory.officeUsers) {
    const owner = byUsername[officer.username];
    const slugs = inventory.collectLeafServiceSpecs(officer.services).map((s) => s.slug);

    const leaves = await Service.findAll({
      where: { slug: slugs, is_folder: false },
      order: [["sort_order", "ASC"]],
    });
    if (!leaves.length) {
      console.warn(`  Skip ${officer.username}: no root services found`);
      continue;
    }
    for (const leaf of leaves) {
      const isHero = await seedHeroIfNeeded(leaf, owner, chef, wali);
      if (!isHero) {
        await seedService(leaf, owner, chef, wali, svcIndex, municipalities);
      }
      svcIndex += 1;
    }
    console.log(`  Filled ${leaves.length} services for ${officer.username}`);
  }

  // Wali instruction to all office users
  const instruction = await WaliInstruction.create({
    title_ar: "تعليمات عامة للتحضير للجلسة",
    title_fr: "Instructions générales — session",
    body_ar:
      "يرجى تحديث ملفاتكم قبل نهاية الأسبوع وتحضير ملخص للسيد الوالي حول النقاط العالقة.",
    body_fr: "Merci de mettre à jour vos dossiers avant la fin de la semaine.",
    created_by_user_id: wali.id,
  });
  for (const u of offices) {
    await WaliInstructionRecipient.create({
      instruction_id: instruction.id,
      user_id: u.id,
      created_at: new Date(),
    });
    await Notification.create({
      user_id: u.id,
      instruction_id: instruction.id,
      message_key: "waliInstruction",
      rapport_id: null,
    });
  }

  // Minimal broadcast (no real file — skip if UploadedFile required)
  // Skip broadcast without file to avoid FK issues.

  console.log(`\nDemo cabinet fill complete: ${svcIndex} services seeded.`);
  console.log("Login with Excel passwords from storage/bootstrap/ (prod bootstrap).");
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
