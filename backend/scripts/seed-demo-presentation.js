"use strict";

/**
 * Reset departments/services/rapports and seed a full presentation dataset
 * (2 real services: Hydraulique + Investissement) with all platform features.
 * Usage: npm run db:seed-demo
 * No storage files required — demo data is DB-only (media slots stay empty).
 */

require("./load-env");

const crypto = require("crypto");

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
  Notification,
  UserServiceGrant,
  Municipality,
  RapportCalendarEvent,
} = require("../src/db");
const {
  buildOfficialHeaderBlocks,
  buildFicheDefaultBlocks,
  buildCommuneDocumentDefaultBlocks,
} = require("../src/modules/rapports/documentDefaults");

const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test1234!";

function rowMeta(overrides = {}) {
  return {
    _row_finished: false,
    _wali_visible: true,
    _highlight: "none",
    _cell_colors: {},
    ...overrides,
  };
}

function headingBlock(textAr, textFr) {
  return { type: "heading", align: "center", bold: true, text_ar: textAr, text_fr: textFr };
}

function paragraphBlock(textAr, textFr) {
  return { type: "paragraph", text_ar: textAr, text_fr: textFr };
}

async function clearAllDomain() {
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
  await sequelize.query("DELETE FROM departments");
  console.log("Cleared departments, services, rapports, and related data.");
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
    schema_json: spec.schema_json,
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
  waliResponses = [],
  calendarEvents = [],
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

function communeStatusTable(id, titleAr, titleFr, rows) {
  return {
    id,
    schema_slug: "commune-suivi",
    schema_name_ar: titleAr,
    schema_name_fr: titleFr,
    columns: [
      { key: "label", type: "text", label_ar: "البند", label_fr: "Rubrique" },
      { key: "value", type: "text", label_ar: "القيمة", label_fr: "Valeur" },
    ],
    layout_json: {},
    table_meta: { title_ar: titleAr, title_fr: titleFr },
    rows,
    rapport_only: true,
  };
}

function buildCommuneComplexEntry(municipality, opts = {}) {
  const tableId = opts.tableId || crypto.randomUUID();
  const blocks = buildCommuneDocumentDefaultBlocks(municipality).concat(opts.extraBlocks || []);
  const embeddedTable = opts.table ? { ...opts.table, id: tableId } : null;
  const embedded_tables = embeddedTable ? [embeddedTable] : [];
  const introAr = opts.introAr || "";
  const introFr = opts.introFr || "";
  const rich_html_ar =
    opts.rich_html_ar ||
    (embedded_tables.length
      ? `<p>${introAr}</p><div data-schema-table-id="${tableId}"></div>`
      : introAr
        ? `<p>${introAr}</p>`
        : "");
  const rich_html_fr =
    opts.rich_html_fr ||
    (embedded_tables.length
      ? `<p>${introFr}</p><div data-schema-table-id="${tableId}"></div>`
      : introFr
        ? `<p>${introFr}</p>`
        : "");
  return {
    blocks,
    rich_html_ar,
    rich_html_fr,
    embedded_tables,
    calendar_events: opts.calendar_events || [],
  };
}

function ficheEmbeddedTable(id, titleAr, titleFr, columns, rows) {
  return {
    id,
    schema_slug: "fiche-summary",
    schema_name_ar: titleAr,
    schema_name_fr: titleFr,
    columns,
    layout_json: {},
    table_meta: { title_ar: titleAr, title_fr: titleFr },
    rows,
    rapport_only: true,
  };
}

function buildHydFicheDataJson(tableId) {
  const introAr =
    "الموضوع: عرض وضعية الموارد المائية والسدود وشبكات التوزيع بتراب ولاية تلمسان، تمهيداً لمتابعة برامج الصيانة والتوسيع.";
  const introFr =
    "Objet: présentation de la situation des ressources en eau, des barrages et des réseaux de distribution dans la wilaya de Tlemcen.";
  const blocks = buildFicheDefaultBlocks().concat([
    paragraphBlock(introAr, introFr),
    paragraphBlock(
      `تاريخ الإعداد: ${new Date().toISOString().slice(0, 10)} — مصلحة الموارد المائية.`,
      `Date: ${new Date().toISOString().slice(0, 10)} — Direction des ressources en eau.`,
    ),
    headingBlock("I — وضعية السدود", "I — État des barrages"),
    paragraphBlock(
      "تتوفر الولاية على ثلاثة سدود رئيسية. الوضعية العامة مستقرة مع انخفاض طفيف في نسب الملء مقارنة بالسنة الماضية، خصوصاً لسد بني بهدل (-4%).",
      "La wilaya dispose de trois barrages principaux. Situation globalement stable avec une légère baisse des taux de remplissage, notamment Beni Bahdel (-4 %).",
    ),
    paragraphBlock(
      "سد تلمسان: سعة 45 مليون م³، نسبة الملء 62% — مستوى طبيعي. سد بني بهدل: 12 مليون م³، نسبة الملء 41% — يتطلب متابعة أسبوعية. سد السواني: 8 مليون م³، نسبة الملء 55%.",
      "Barrage Tlemcen: 45 Mm³, remplissage 62 %. Barrage Beni Bahdel: 12 Mm³, 41 % — suivi hebdomadaire. Barrage Souani: 8 Mm³, 55 %.",
    ),
    headingBlock("II — شبكات التوزيع", "II — Réseaux de distribution"),
    paragraphBlock(
      "شبكة التوزيع الحضرية: 186 كm، تغطية 94% من الأحياء المركزية. الضواحي: 78 كm، نقاط ضغط منخفض في حي بن سنوس وعين نحالة.",
      "Réseau urbain: 186 km, couverture 94 %. Périphérie: 78 km, points de basse pression (Ben Snous, Ain Nehala).",
    ),
    paragraphBlock(
      "برنامج توسيع عين نحالة: 3.1 كm قيد الإنجاز (85%). صيانة محطات الضخ: 6 محطات برمجت لهذا الربع.",
      "Extension Ain Nehala: 3,1 km en cours (85 %). Maintenance stations de pompage: 6 stations ce trimestre.",
    ),
    { type: "media_row", items: [{ file_id: null }, { file_id: null }] },
    headingBlock("III — التوصيات", "III — Recommandations"),
    paragraphBlock(
      "1) إطلاق أعمال صيانة سد بني بهدل قبل نهاية الربع. 2) تسريع توسيع شبكة عين نحالة. 3) تعزيز مراقبة جودة المياه في المناطق الساحلية.",
      "1) Lancer la maintenance du barrage Beni Bahdel avant fin de trimestre. 2) Accélérer l'extension Ain Nehala. 3) Renforcer le contrôle qualité en zone côtière.",
    ),
  ]);

  const rich_html_ar = [
    `<p><strong>${introAr}</strong></p>`,
    `<p>تُقدَّم هذه المذكرة الاستخلاصية لعرض أبرز المؤشرات الميدانية والبرامج الجارية في قطاع الموارد المائية.</p>`,
    `<p><strong>I — وضعية السدود</strong></p>`,
    `<p>الوضعية العامة مستقرة. يُلاحظ تراجع طفيف في ملء سد بني بهدل يستدعي تدخل صيانة وقائية.</p>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — شبكات التوزيع</strong></p>`,
    `<p>معدل التغطية بالمياه الشروب 92% على مستوى الولاية. أعمال التوسيع مستمرة في بلديات عين نحالة والغزوات.</p>`,
    `<p><strong>III — التوصيات</strong></p>`,
    `<p>المصلحة توصي باعتماد برنامج الصيانة العاجل لسد بني بهدل ومتابعة تنفيذ توسيع شبكة عين نحالة.</p>`,
  ].join("");

  const rich_html_fr = [
    `<p><strong>${introFr}</strong></p>`,
    `<p>Cette fiche lecture présente les principaux indicateurs terrain et programmes en cours dans le secteur hydraulique.</p>`,
    `<p><strong>I — État des barrages</strong></p>`,
    `<p>Situation globalement stable. Légère baisse au barrage Beni Bahdel nécessitant une maintenance préventive.</p>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — Réseaux de distribution</strong></p>`,
    `<p>Taux de couverture AEP: 92 % à l'échelle wilaya. Extensions en cours à Ain Nehala et Ghazaouet.</p>`,
    `<p><strong>III — Recommandations</strong></p>`,
    `<p>Maintenance urgente Beni Bahdel et suivi de l'extension du réseau Ain Nehala.</p>`,
  ].join("");

  return {
    blocks,
    rich_html_ar,
    rich_html_fr,
    embedded_tables: [
      ficheEmbeddedTable(
        tableId,
        "ملخص مؤشرات السدود",
        "Synthèse indicateurs barrages",
        [
          { key: "dam", type: "text", label_ar: "السد", label_fr: "Barrage" },
          {
            key: "capacity",
            type: "text",
            label_ar: "السعة",
            label_fr: "Capacité",
          },
          {
            key: "fill_pct",
            type: "text",
            label_ar: "نسبة الملء",
            label_fr: "Remplissage",
          },
          { key: "status", type: "text", label_ar: "الحالة", label_fr: "Statut" },
          { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
        ],
        [
          rowMeta({
            dam: "سد تلمسان",
            capacity: "45 Mm³",
            fill_pct: "62%",
            status: "مستقر",
            notes: "وضعية طبيعية",
            _cell_colors: { fill_pct: "info", status: "success" },
          }),
          rowMeta({
            dam: "سد بني بهدل",
            capacity: "12 Mm³",
            fill_pct: "41%",
            status: "مراقبة",
            notes: "انخفاض — صيانة مطلوبة",
            _cell_colors: { fill_pct: "warning", status: "warning", notes: "important" },
          }),
          rowMeta({
            dam: "سد السواني",
            capacity: "8 Mm³",
            fill_pct: "55%",
            status: "مستقر",
            notes: "—",
            _cell_colors: { fill_pct: "info" },
          }),
          rowMeta({
            dam: "سد واد لحلاف",
            capacity: "3 Mm³",
            fill_pct: "48%",
            status: "مستقر",
            notes: "منطقة جبلية",
          }),
        ],
      ),
    ],
  };
}

function buildInvFicheDataJson(tableId) {
  const introAr =
    "الموضوع: نتائج أشغال الخلية الولائية المتعلقة بمتابعة تسوية المشاريع الاستثمارية — دورة 2026.";
  const introFr =
    "Objet: résultats des travaux de la cellule wilaya — suivi de la régularisation des projets d'investissement — session 2026.";
  const blocks = buildFicheDefaultBlocks().concat([
    paragraphBlock(introAr, introFr),
    paragraphBlock(
      "إشارة إلى محضر الجلسة المنعقدة بتاريخ الأسبوع الجاري، يُعرض أدناه ملخص المشاريع قيد المتابعة والمبالغ المرصودة.",
      "Référence au procès-verbal de la session de la semaine — synthèse des projets suivis et montants engagés.",
    ),
    headingBlock("I — مؤشرات عامة", "I — Indicateurs généraux"),
    paragraphBlock(
      "عدد المشاريع المتابعة: 47 مشروعاً. المبلغ الإجمالي: 285 مليار دج. متوسط نسبة الإنجاز: 58%. مشاريع متأخرة: 8 (17%).",
      "Projets suivis: 47. Montant total: 285 Md DZD. Avancement moyen: 58 %. Projets en retard: 8 (17 %).",
    ),
    paragraphBlock(
      "الخلية الولائية أوصت بجلسات متابعة شهرية للمشاريع ذات النسب دون 40%، ورفع ملفات التراخيص المتأخرة إلى المصالح المعنية.",
      "La cellule recommande un suivi mensuel pour les projets < 40 % et le relèvement des dossiers d'autorisation en retard.",
    ),
    headingBlock("II — أبرز المشاريع", "II — Projets principaux"),
    paragraphBlock(
      "مجمع صناعي مغنية (120 Md — 75%)، فندق تلمسان (45 Md — 35%)، محطة تعبئة عين نحالة (28 Md — 90%).",
      "Complexe Maghnia (120 Md — 75 %), hôtel Tlemcen (45 Md — 35 %), station Ain Nehala (28 Md — 90 %).",
    ),
    { type: "media_row", items: [{ file_id: null }] },
    headingBlock("III — التوصيات", "III — Recommandations"),
    paragraphBlock(
      "1) تسريع إجراءات فندق تلمسان. 2) تسليم محطة عين نحالة قبل الصيف. 3) عقد لقاء مع المستثمرين بالمنطقة الصناعية مغنية.",
      "1) Accélérer l'hôtel Tlemcen. 2) Réception station Ain Nehala avant l'été. 3) Rencontre investisseurs zone Maghnia.",
    ),
  ]);

  const rich_html_ar = [
    `<p><strong>${introAr}</strong></p>`,
    `<p>تُرفق هذه المذكرة الاستخلاصية جدولاً تفصيلياً لأهم المشاريع الاستثمارية المعروضة على قرار الوالي.</p>`,
    `<p><strong>I — مؤشرات عامة</strong></p>`,
    `<ul><li>47 مشروعاً تحت المتابعة</li><li>285 مليار دج من الاستثمارات</li><li>8 مشاريع في حالة تأخر</li><li>12 مشروعاً شبه منجز (&gt; 90%)</li></ul>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — التوصيات</strong></p>`,
    `<p>طلب اعتماد المذكرة وموافاة الخلية بقرار الوالي بخصوص المشاريع المتأخرة.</p>`,
  ].join("");

  const rich_html_fr = [
    `<p><strong>${introFr}</strong></p>`,
    `<p>Cette fiche lecture est accompagnée d'un tableau détaillé des principaux projets soumis à la décision du wali.</p>`,
    `<p><strong>I — Indicateurs généraux</strong></p>`,
    `<ul><li>47 projets suivis</li><li>285 Md DZD d'investissements</li><li>8 projets en retard</li><li>12 projets quasi achevés (&gt; 90 %)</li></ul>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — Recommandations</strong></p>`,
    `<p>Demande d'avis favorable et retour de la cellule après décision du wali sur les projets en retard.</p>`,
  ].join("");

  return {
    blocks,
    rich_html_ar,
    rich_html_fr,
    embedded_tables: [
      ficheEmbeddedTable(
        tableId,
        "ملخص المشاريع الاستثمارية",
        "Synthèse projets investissement",
        [
          {
            key: "project_title",
            type: "text",
            label_ar: "المشروع",
            label_fr: "Projet",
          },
          { key: "owner", type: "text", label_ar: "المالك", label_fr: "Maître d'ouvrage" },
          {
            key: "municipality",
            type: "text",
            label_ar: "البلدية",
            label_fr: "Commune",
          },
          {
            key: "total_amount",
            type: "text",
            label_ar: "المبلغ (دج)",
            label_fr: "Montant (DZD)",
          },
          {
            key: "completion_pct",
            type: "text",
            label_ar: "نسبة الإنجاز",
            label_fr: "Avancement",
          },
          { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
        ],
        [
          rowMeta({
            project_title: "مجمع صناعي — مغنية",
            owner: "Groupe Maghnia SA",
            municipality: "مغنية",
            total_amount: "120 000 000",
            completion_pct: "75%",
            notes: "إنجاز جيد",
            _cell_colors: { completion_pct: "success" },
          }),
          rowMeta({
            project_title: "فندق — تلمسان",
            owner: "SARL Tourisme",
            municipality: "تلمسان",
            total_amount: "45 000 000",
            completion_pct: "35%",
            notes: "تأخر تراخيص",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
          rowMeta({
            project_title: "محطة تعبئة — عين نحالة",
            owner: "Hydrocarbures Ouest",
            municipality: "عين نحالة",
            total_amount: "28 000 000",
            completion_pct: "90%",
            notes: "شبه منجز",
            _cell_colors: { completion_pct: "info" },
          }),
          rowMeta({
            project_title: "مصنع تعبئة — تلمسان",
            owner: "شركة SA",
            municipality: "تلمسان",
            total_amount: "85 000 000",
            completion_pct: "52%",
            notes: "قيد التنفيذ",
          }),
          rowMeta({
            project_title: "مركز تجاري — الرمشي",
            owner: "Promo Ouest",
            municipality: "الرمشي",
            total_amount: "32 000 000",
            completion_pct: "18%",
            notes: "تأخر كبير",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
        ],
      ),
    ],
  };
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
  const wali = await ensureUser({
    username: "wali1",
    name: "والي — عرض تجريبي",
    role: "WALI",
    templateSlug: "WALI_STANDARD",
  });

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
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
    name_ar: "المشاريع حسب البلدية",
    name_fr: "Projets par commune",
    layout_kind: "grid",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "table",
    schema_json: { table_schema_slug: "investissement-projets", table_key: "main" },
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

  await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydTable.id,
    title: `حالة السدود — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "changes_requested",
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
    calendarEvents: [
      {
        event_date: weekAnchor,
        title_ar: "موعد متابعة السدود",
        title_fr: "Échéance suivi barrages",
        note_ar: "عرض على الوالي",
      },
    ],
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

  await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydDoc.id,
    title: `توزيع المياه — عين نحالة — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
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
        note_ar: "مذكرة للوالي",
      },
    ],
  });

  await createRapportBundle({
    serviceId: svcHyd.id,
    typeId: typeHydCommune.id,
    title: `متابعة التوزيع — بلديات (ملف مركّب) — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
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

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvTable.id,
    title: `تسوية المشاريع — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "under_review",
    versions: [
      { number: 1, data_json: invTableV1, submitted_at: dayAgo },
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

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvCommune.id,
    title: `المشاريع حسب البلدية — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
    versions: [
      {
        number: 1,
        data_json: {
          communes: {
            "1301": {
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
            "1327": {
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
          },
          schema_snapshot: invSchemaSnap,
        },
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

  await createRapportBundle({
    serviceId: svcInv.id,
    typeId: typeInvFiche.id,
    title: `مذكرة استخلاصية — تسوية المشاريع — ${weekAnchor}`,
    ownerId: office.id,
    authorId: office.id,
    status: "submitted",
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

  console.log("\n=== Demo presentation seed complete ===\n");
  console.log("Logins (password for office1 / wali1):", TEST_PASSWORD);
  console.log("\nDepartments:");
  console.log(`  [${deptHyd.id}] ${deptHyd.name_ar}`);
  console.log(`  [${deptInv.id}] ${deptInv.name_ar}`);
  console.log("\nServices:");
  console.log(`  [${svcHyd.id}] hydraulique — ${svcHyd.name_ar}`);
  console.log(`  [${svcInv.id}] investissement — ${svcInv.name_ar}`);
  console.log("\nHighlights:");
  console.log("  • Table: grouped headers, formulas, colors, merge, versions, wali response");
  console.log("  • Document: templates, embedded tables");
  console.log("  • Commune complex (rich HTML + embedded tables + calendar) + commune table");
  console.log("  • Fiche lecture: rich text, embedded tables, wali response");
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
