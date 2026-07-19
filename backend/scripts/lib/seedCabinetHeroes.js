"use strict";

/**
 * Full Demo-1 presentation fill for cabinet hero services (eau + investissement).
 * Used by seed-demo-cabinet.js only.
 */

const crypto = require("crypto");
const {
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
  Direction,
} = require("../../src/db");
const {
  buildFicheDefaultBlocks,
  buildOfficialHeaderBlocks,
  buildCommuneDocumentDefaultBlocks,
} = require("../../src/modules/rapports/documentDefaults");
const { entityKey } = require("../../src/modules/rapports/entityKeys");
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
  buildHydTableV1,
  buildHydTableV2,
  buildInvTableV1,
  HERO_SLUGS,
} = require("./demoPresentationData");

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

async function ensureDirectionInv() {
  let dir = await Direction.findOne({ where: { code: "DIR02" } });
  if (dir) return dir;
  return Direction.create({
    code: "DIR02",
    name_ar: "مديرية الاستثمار",
    name_fr: "Direction de l'investissement",
  });
}

function dates() {
  const now = new Date();
  const weekAnchor = now.toISOString().slice(0, 10);
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  return { now, weekAnchor, dayAgo, twoDaysAgo, threeDaysAgo };
}

async function seedHeroHydraulique({ svc, owner, chef, wali }) {
  const { now, weekAnchor, dayAgo, twoDaysAgo, threeDaysAgo } = dates();

  await RapportTableSchema.create({
    service_id: svc.id,
    slug: "hydraulique-barrages",
    name_ar: "جدول السدود",
    name_fr: "Tableau des barrages",
    columns_json: hydBarrageCols,
    layout_json: hydBarrageLayout,
    is_system: false,
  });

  const typeHydTable = await createType(svc.id, {
    slug: "barrages_etat",
    name_ar: "حالة السدود",
    name_fr: "État des barrages",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "hydraulique-barrages", table_key: "main" },
  });

  const typeHydDoc = await createType(svc.id, {
    slug: "distribution_eau",
    name_ar: "برنامج توزيع المياه",
    name_fr: "Programme distribution eau",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "standalone",
    schema_json: null,
  });

  const typeHydCommune = await createType(svc.id, {
    slug: "distribution_communes",
    name_ar: "متابعة التوزيع حسب البلدية",
    name_fr: "Suivi distribution par commune",
    layout_kind: "memo",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    schema_json: null,
  });

  await createType(svc.id, {
    slug: "barrages_archive_hidden",
    name_ar: "أرشيف السدود (مخفي للعرض)",
    name_fr: "Archives barrages (masqué démo)",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "hydraulique-barrages", table_key: "main" },
    hidden_at: now,
  });

  const typeHydFiche = await RapportType.create({
    service_id: svc.id,
    slug: "fiche_lecture",
    name_ar: "مذكرة استخلاصية",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: { default_blocks: buildFicheDefaultBlocks() },
  });

  const embeddedHydTableId = crypto.randomUUID();
  const embeddedHydFicheTableId = crypto.randomUUID();
  const hydCommuneTable1325 = crypto.randomUUID();
  const hydCommuneTable1301 = crypto.randomUUID();

  await RapportDocumentTemplate.create({
    service_id: svc.id,
    rapport_type_id: typeHydDoc.id,
    rapport_type_ids: [typeHydDoc.id],
    slug: "hydraulique-distribution-template",
    name_ar: "نموذج توزيع — عين نحالة",
    name_fr: "Modèle distribution — Ain Nehala",
    content_kind: "document_compose",
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
            { key: "zone", type: "text", label_ar: "المنطقة", label_fr: "Zone" },
            {
              key: "length_km",
              type: "number",
              format: "decimal",
              label_ar: "طول الشبكة (كم)",
              label_fr: "Longueur (km)",
            },
            { key: "status", type: "text", label_ar: "الحالة", label_fr: "Statut" },
          ],
          layout_json: {},
          table_meta: { title_ar: "شبكة التوزيع — عين نحالة", title_fr: "Réseau — Ain Nehala" },
          rows: [
            rowMeta({ zone: "الوسط", length_km: 12.5, status: "جيد", _cell_colors: { status: "success" } }),
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

  const hydTableBundle = await createRapportBundle({
    serviceId: svc.id,
    typeId: typeHydTable.id,
    title: `حالة السدود — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
    status: "changes_requested",
    chefGate: "bypass",
    versions: [
      { number: 1, data_json: buildHydTableV1(), submitted_at: twoDaysAgo },
      { number: 2, data_json: buildHydTableV2(), submitted_at: null },
    ],
    waliResponses: [
      {
        versionNumber: 1,
        decision: "changes_requested",
        body_text: "يرجى تحديث نسب الملء لسد بني بهدل وإرفاق صور حديثة.",
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
    { type: "media_row", items: [{ file_id: null }] },
  );

  await createRapportBundle({
    serviceId: svc.id,
    typeId: typeHydDoc.id,
    title: `توزيع المياه — عين نحالة — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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
              table_meta: { title_ar: "شبكة عين نحالة", title_fr: "Réseau Ain Nehala" },
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
    serviceId: svc.id,
    typeId: typeHydCommune.id,
    title: `متابعة التوزيع — بلديات (ملف مركّب) — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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
                    rowMeta({ label: "طول الشبكة (كم)", value: "18.4", _cell_colors: { value: "info" } }),
                    rowMeta({ label: "نسبة التغطية", value: "92%", _cell_colors: { value: "success" } }),
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
                table: communeStatusTable(hydCommuneTable1301, "مؤشرات الشبكة", "Indicateurs réseau", [
                  rowMeta({ label: "الضغط (bar)", value: "3.2" }),
                  rowMeta({ label: "الحالة", value: "مراقبة", _cell_colors: { value: "warning" } }),
                ]),
              },
            ),
            "1307": buildCommuneComplexEntry(
              { name_ar: "الغزوات", name_fr: "Ghazaouet" },
              {
                introAr: "منطقة ساحلية — شبكة توزيع محدودة.",
                introFr: "Zone côtière — réseau de distribution limité.",
                extraBlocks: [
                  paragraphBlock("مشروع تمديد قيد الدراسة.", "Projet de extension en étude."),
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
    serviceId: svc.id,
    typeId: typeHydFiche.id,
    title: `مذكرة استخلاصية — الموارد المائية — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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

  const c2 = await RapportComment.create({
    rapport_id: hydCommuneBundle.rapport.id,
    author_user_id: owner.id,
    rapport_version_id: hydCommuneBundle.versions[0].id,
    body_text: "ملف البلديات جاهز للمناقشة.",
    created_at: dayAgo,
  });
  for (const uid of [chef.id, wali.id]) {
    await Notification.create({
      user_id: uid,
      rapport_id: hydCommuneBundle.rapport.id,
      comment_id: c2.id,
      message_key: "rapportComment",
      created_at: dayAgo,
    });
  }

  const instr = await WaliInstruction.create({
    title_ar: "تعليمة خاصة — مصلحة المياه",
    title_fr: "Instruction ciblée — hydraulique",
    body_ar: "تحديث نسب ملء السدود قبل زيارة السيد الوالي.",
    body_fr: "Mettre à jour les taux de remplissage avant la visite du Wali.",
    created_by_user_id: wali.id,
  });
  await WaliInstructionRecipient.create({
    instruction_id: instr.id,
    user_id: owner.id,
    created_at: now,
  });
  await Notification.create({
    user_id: owner.id,
    instruction_id: instr.id,
    message_key: "waliInstruction",
    created_at: now,
  });

  console.log(`  HERO hydraulique: 4 rapports + discussion + instruction (${svc.slug})`);
}

async function seedHeroInvestissement({ svc, owner, chef, wali }) {
  const { now, weekAnchor, dayAgo, twoDaysAgo } = dates();
  const dirInv = await ensureDirectionInv();
  const invSchemaSnap = { columns: invCols, layout_json: invLayout };

  await RapportTableSchema.create({
    service_id: svc.id,
    slug: "investissement-projets",
    name_ar: "جدول المشاريع",
    name_fr: "Tableau des projets",
    columns_json: invCols,
    layout_json: invLayout,
    is_system: false,
  });

  const typeInvTable = await createType(svc.id, {
    slug: "projets_investissement",
    name_ar: "تسوية المشاريع الاستثمارية",
    name_fr: "Projets investissement",
    layout_kind: "grid",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    schema_json: { table_schema_slug: "investissement-projets", table_key: "main" },
  });

  const typeInvCommune = await createType(svc.id, {
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

  const typeInvCommuneComplex = await createType(svc.id, {
    slug: "suivi_communes_complex",
    name_ar: "متابعة المشاريع — ملف البلدية",
    name_fr: "Suivi projets — dossier commune",
    layout_kind: "memo",
    content_kind: "commune_list",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    schema_json: null,
  });

  const typeInvDoc = await createType(svc.id, {
    slug: "memo_cellule",
    name_ar: "مذكرة الخلية الولائية",
    name_fr: "Mémo cellule wilaya",
    layout_kind: "memo",
    content_kind: "document_compose",
    versioning_mode: "standalone",
    schema_json: null,
  });

  const typeInvFiche = await RapportType.create({
    service_id: svc.id,
    slug: "fiche_lecture",
    name_ar: "مذكرة استخلاصية",
    name_fr: "Fiche lecture",
    layout_kind: "memo",
    content_kind: "fiche_lecture",
    versioning_mode: "standalone",
    schema_json: { default_blocks: buildFicheDefaultBlocks() },
  });

  const embeddedInvTableId = crypto.randomUUID();
  const embeddedInvFicheTableId = crypto.randomUUID();
  const invCommuneTable1301 = crypto.randomUUID();
  const invCommuneTable1327 = crypto.randomUUID();

  await RapportDocumentTemplate.create({
    service_id: svc.id,
    rapport_type_id: typeInvDoc.id,
    rapport_type_ids: [typeInvDoc.id],
    slug: "investissement-memo-template",
    name_ar: "نموذج مذكرة الخلية",
    name_fr: "Modèle mémo cellule",
    content_kind: "document_compose",
    is_default: true,
    content_json: {
      rich_html_ar: "<p>نتائج أشغال الخلية الولائية المتعلقة بمتابعة تسوية المشاريع الاستثمارية.</p>",
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
          table_meta: { title_ar: "ملخص المشاريع", title_fr: "Synthèse projets" },
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

  const invTableBundle = await createRapportBundle({
    serviceId: svc.id,
    typeId: typeInvTable.id,
    title: `تسوية المشاريع — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
    status: "under_review",
    chefGate: "required",
    versions: [{ number: 1, data_json: buildInvTableV1(), submitted_at: dayAgo }],
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
          project_title: "فندق تلمسان",
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
    serviceId: svc.id,
    typeId: typeInvCommune.id,
    title: `المشاريع حسب البلدية / الدائرة / المديرية — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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
    serviceId: svc.id,
    typeId: typeInvCommuneComplex.id,
    title: `متابعة المشاريع — ملفات البلديات — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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
                table: communeStatusTable(invCommuneTable1301, "بيانات المشروع", "Données projet", [
                  rowMeta({ label: "المبلغ (دج)", value: "45 000 000", _cell_colors: { value: "info" } }),
                  rowMeta({ label: "نسبة الإنجاز", value: "35%", _cell_colors: { value: "warning" } }),
                  rowMeta({ label: "صاحب المشروع", value: "SARL Tourisme" }),
                ]),
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
                table: communeStatusTable(invCommuneTable1327, "مؤشرات المشروع", "Indicateurs projet", [
                  rowMeta({
                    label: "المبلغ (دج)",
                    value: "120 000 000",
                    _cell_colors: { value: "success" },
                  }),
                  rowMeta({ label: "نسبة الإنجاز", value: "75%" }),
                ]),
              },
            ),
            "1325": buildCommuneComplexEntry(
              { name_ar: "عين نحالة", name_fr: "Ain Nehala" },
              {
                introAr: "محطة تعبئة — شبه منجز.",
                introFr: "Station-service — quasi achevé.",
                extraBlocks: [
                  paragraphBlock("في انتظار التسليم النهائي.", "En attente de réception définitive."),
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
    serviceId: svc.id,
    typeId: typeInvDoc.id,
    title: `مذكرة الخلية — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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
    serviceId: svc.id,
    typeId: typeInvFiche.id,
    title: `مذكرة استخلاصية — تسوية المشاريع — ${weekAnchor}`,
    ownerId: owner.id,
    authorId: owner.id,
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

  const discussionRapport = invTableBundle.rapport;
  const discussionVersion = invTableBundle.versions[0];
  const commentOffice = await RapportComment.create({
    rapport_id: discussionRapport.id,
    author_user_id: owner.id,
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
    [owner.id, commentChef.id],
    [wali.id, commentChef.id],
    [owner.id, commentWali.id],
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

  const instr = await WaliInstruction.create({
    title_ar: "تعليمة خاصة — مصلحة الاستثمار",
    title_fr: "Instruction ciblée — investissement",
    body_ar: "تحضير ملف المشاريع المتأخرة لجلسة الخلية الولائية.",
    body_fr: "Préparer le dossier des projets en retard pour la session cellule.",
    created_by_user_id: wali.id,
  });
  await WaliInstructionRecipient.create({
    instruction_id: instr.id,
    user_id: owner.id,
    created_at: now,
  });
  await Notification.create({
    user_id: owner.id,
    instruction_id: instr.id,
    message_key: "waliInstruction",
    created_at: now,
  });

  console.log(`  HERO investissement: 5 rapports + 3-way discussion + instruction (${svc.slug})`);
}

async function seedHeroIfNeeded(leaf, owner, chef, wali) {
  if (leaf.slug === HERO_SLUGS.HYDRAULIQUE) {
    await seedHeroHydraulique({ svc: leaf, owner, chef, wali });
    return true;
  }
  if (leaf.slug === HERO_SLUGS.INVESTISSEMENT) {
    await seedHeroInvestissement({ svc: leaf, owner, chef, wali });
    return true;
  }
  return false;
}

module.exports = {
  seedHeroIfNeeded,
  HERO_SLUGS,
};
