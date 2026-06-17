const { Op } = require("sequelize");
const {
  sequelize,
  Service,
  Department,
  RapportType,
  Rapport,
  RapportVersion,
  WaliResponse,
  Notification,
  User,
  WaliBroadcast,
  RapportView,
} = require("../../db");
const { audit } = require("../../services/audit");
const { loadSchemaBySlug } = require("./tableGridService");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(query.pageSize, 10) || 20),
  );
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

async function listServices() {
  return Service.findAll({
    where: { is_active: true },
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name_ar", "name_fr"],
      },
      {
        model: RapportType,
        as: "rapportTypes",
        attributes: [
          "id",
          "slug",
          "name_ar",
          "name_fr",
          "layout_kind",
          "versioning_mode",
          "content_kind",
        ],
      },
    ],
  });
}

async function listRapports(query, opts = {}) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.service_id) where.service_id = query.service_id;
  if (query.rapport_type_id) where.rapport_type_id = query.rapport_type_id;
  if (query.search) {
    where.title = { [Op.iLike]: `%${String(query.search).trim()}%` };
  }
  if (query.has_version === "1" || query.has_version === "true") {
    where.current_version_id = { [Op.ne]: null };
  }
  if (opts.inboxOnly) {
    where.status = {
      [Op.in]: [
        "submitted",
        "under_review",
        "changes_requested",
        "acknowledged",
      ],
    };
    where.hidden_at = null;
  }

  if (query.hidden_only === "1" || query.hidden_only === "true") {
    where.hidden_at = { [Op.ne]: null };
  } else if (query.include_hidden !== "1" && query.include_hidden !== "true") {
    where.hidden_at = null;
  }

  const rapportTypeInclude = {
    model: RapportType,
    as: "rapportType",
    attributes: [
      "id",
      "slug",
      "name_ar",
      "name_fr",
      "layout_kind",
      "versioning_mode",
      "content_kind",
    ],
  };
  const importable = query.importable === "1" || query.importable === "true";
  if (importable && !query.content_kind) {
    query.content_kind = "table_grid";
  }
  if (importable) {
    rapportTypeInclude.attributes = [
      "id",
      "slug",
      "name_ar",
      "name_fr",
      "layout_kind",
      "versioning_mode",
      "content_kind",
      "schema_json",
    ];
  }
  if (query.content_kind) {
    rapportTypeInclude.where = { content_kind: query.content_kind };
    rapportTypeInclude.required = true;
  }

  const includes = [
    {
      model: Service,
      as: "service",
      attributes: ["id", "slug", "name_ar", "name_fr"],
    },
    rapportTypeInclude,
    {
      model: User,
      as: "createdByUser",
      attributes: ["id", "name", "username"],
    },
  ];
  if (importable) {
    includes.push({
      model: RapportVersion,
      as: "currentVersion",
      attributes: ["id", "data_json"],
      required: false,
    });
  }

  const { rows, count } = await Rapport.findAndCountAll({
    where,
    order: [["updated_at", "DESC"]],
    offset,
    limit,
    include: includes,
  });

  let rapports = rows;
  if (importable) {
    const schemaCache = new Map();
    const enriched = [];
    for (const r of rows) {
      const plain = r.toJSON ? r.toJSON() : r;
      if (plain.rapportType?.content_kind !== "table_grid") continue;
      const table = plain.currentVersion?.data_json?.tables?.[0];
      if (!table?.rows?.length) continue;

      const slug = plain.rapportType?.schema_json?.table_schema_slug;
      let schema_name_ar = null;
      let schema_name_fr = null;
      let column_count = 0;
      const column_labels_ar = [];
      const column_labels_fr = [];
      if (slug) {
        if (!schemaCache.has(slug)) {
          try {
            schemaCache.set(slug, await loadSchemaBySlug(slug));
          } catch {
            schemaCache.set(slug, null);
          }
        }
        const sch = schemaCache.get(slug);
        if (sch) {
          schema_name_ar = sch.name_ar;
          schema_name_fr = sch.name_fr;
          const cols = sch.columns_json || [];
          column_count = cols.length;
          for (const col of cols.slice(0, 10)) {
            column_labels_ar.push(col.label_ar);
            column_labels_fr.push(col.label_fr);
          }
        }
      }

      const { currentVersion, ...rest } = plain;
      enriched.push({
        ...rest,
        import_summary: {
          schema_name_ar,
          schema_name_fr,
          rapport_type_name_ar: plain.rapportType?.name_ar,
          rapport_type_name_fr: plain.rapportType?.name_fr,
          table_title_ar: table.title_ar,
          table_title_fr: table.title_fr,
          row_count: table.rows.length,
          column_count,
          column_labels_ar,
          column_labels_fr,
        },
      });
    }
    rapports = enriched;
  } else {
    rapports = rows.map((r) => (r.toJSON ? r.toJSON() : r));
  }

  if (opts.enrichForOfficeUserId) {
    rapports = await enrichOfficeRapportList(
      rapports,
      opts.enrichForOfficeUserId,
    );
  }

  if (opts.enrichForWaliUserId) {
    rapports = await enrichWaliRapportList(rapports, opts.enrichForWaliUserId);
  }

  return {
    rapports,
    total: importable ? rapports.length : count,
    page,
    pageSize,
  };
}

async function enrichWaliRapportList(rapports, waliUserId) {
  if (!rapports?.length || !waliUserId) return rapports;
  const ids = rapports.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return rapports;

  const [views, responses] = await Promise.all([
    RapportView.findAll({
      where: { rapport_id: ids, user_id: waliUserId },
      attributes: ["rapport_id"],
    }),
    WaliResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: [
        "rapport_id",
        "decision",
        "follow_up_status",
        "body_text",
        "created_at",
      ],
    }),
  ]);

  const viewedSet = new Set(views.map((v) => Number(v.rapport_id)));
  const latestByRapport = new Map();
  for (const wr of responses) {
    const rid = Number(wr.rapport_id);
    if (!latestByRapport.has(rid)) {
      latestByRapport.set(rid, {
        decision: wr.decision,
        follow_up_status: wr.follow_up_status,
        body_text: wr.body_text,
        created_at: wr.created_at,
      });
    }
  }

  return rapports.map((r) => {
    const rid = Number(r.id);
    const wali_viewed = viewedSet.has(rid);
    return {
      ...r,
      wali_viewed,
      is_inbox_new: r.status === "submitted" && !wali_viewed,
      latest_wali_response: latestByRapport.get(rid) || null,
    };
  });
}

async function enrichOfficeRapportList(rapports, userId) {
  if (!rapports?.length || !userId) return rapports;
  const ids = rapports.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return rapports;

  const [responses, unreadNotes] = await Promise.all([
    WaliResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: [
        "rapport_id",
        "decision",
        "follow_up_status",
        "body_text",
        "created_at",
      ],
    }),
    Notification.findAll({
      where: { user_id: userId, rapport_id: ids, read_at: null },
      attributes: ["rapport_id"],
    }),
  ]);

  const latestByRapport = new Map();
  for (const wr of responses) {
    const rid = Number(wr.rapport_id);
    if (!latestByRapport.has(rid)) {
      latestByRapport.set(rid, {
        decision: wr.decision,
        follow_up_status: wr.follow_up_status,
        body_text: wr.body_text,
        created_at: wr.created_at,
      });
    }
  }

  const unreadSet = new Set(unreadNotes.map((n) => Number(n.rapport_id)));

  return rapports.map((r) => ({
    ...r,
    latest_wali_response: latestByRapport.get(Number(r.id)) || null,
    has_unread_notification: unreadSet.has(Number(r.id)),
  }));
}

async function getRapportDetail(id, versionId = null) {
  const rapport = await Rapport.findByPk(id, {
    include: [
      { model: Service, as: "service" },
      { model: RapportType, as: "rapportType" },
      { model: RapportVersion, as: "currentVersion" },
      { model: RapportVersion, as: "versions" },
      {
        model: WaliResponse,
        as: "waliResponses",
        order: [["created_at", "DESC"]],
      },
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
    ],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const plain = rapport.toJSON ? rapport.toJSON() : rapport;

  if (versionId) {
    const requestedVersion = await RapportVersion.findOne({
      where: { id: versionId, rapport_id: id },
    });
    if (requestedVersion) {
      plain.currentVersion = requestedVersion.toJSON
        ? requestedVersion.toJSON()
        : requestedVersion;
    }
  } else if (
    !plain.currentVersion &&
    plain.current_version_id &&
    plain.versions?.length
  ) {
    plain.currentVersion =
      plain.versions.find((v) => v.id === plain.current_version_id) ||
      plain.versions[0];
  }

  return plain;
}

async function createRapport(data, actor, req) {
  const rapportType = await RapportType.findByPk(data.rapport_type_id);
  if (
    !rapportType ||
    Number(rapportType.service_id) !== Number(data.service_id)
  ) {
    const err = new Error("Invalid rapport type");
    err.status = 400;
    throw err;
  }
  const rapport = await Rapport.create({
    service_id: data.service_id,
    rapport_type_id: data.rapport_type_id,
    title: data.title,
    reference_date: data.reference_date || null,
    status: "draft",
    created_by_user_id: actor.id,
    owner_office_user_id:
      rapportType.content_kind === "fiche_lecture"
        ? null
        : actor.role === "OFFICE_USER"
          ? actor.id
          : data.owner_office_user_id || actor.id,
  });
  const version = await RapportVersion.create({
    rapport_id: rapport.id,
    version_number: 1,
    data_json: data.data_json || {},
    created_by_user_id: actor.id,
  });
  await rapport.update({ current_version_id: version.id });
  await audit(actor.id, "RAPPORT_CREATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function updateRapportDraft(id, data, actor, req) {
  let rapport = await Rapport.findByPk(id, {
    include: [
      { model: RapportVersion, as: "currentVersion" },
      { model: RapportType, as: "rapportType" },
    ],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }
  if (rapport.currentVersion?.submitted_at) {
    await reopenDraftAfterSubmit(rapport, actor);
    rapport = await Rapport.findByPk(id, {
      include: [{ model: RapportVersion, as: "currentVersion" }],
    });
    if (!rapport) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
  }
  await rapport.update({
    ...(data.title != null ? { title: data.title } : {}),
    ...(data.reference_date !== undefined
      ? { reference_date: data.reference_date }
      : {}),
    updated_at: new Date(),
  });
  if (data.data_json && rapport.current_version_id) {
    await RapportVersion.update(
      { data_json: data.data_json },
      { where: { id: rapport.current_version_id } },
    );
  }
  await audit(actor.id, "RAPPORT_UPDATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

function cloneVersionData(dataJson) {
  return JSON.parse(JSON.stringify(dataJson || {}));
}

async function createNextRapportVersion(rapportId, dataJson, actorId) {
  const last = await RapportVersion.findOne({
    where: { rapport_id: rapportId },
    order: [["version_number", "DESC"]],
  });
  const nextNum = (last?.version_number || 0) + 1;
  return RapportVersion.create({
    rapport_id: rapportId,
    version_number: nextNum,
    data_json: cloneVersionData(dataJson),
    created_by_user_id: actorId,
  });
}

function draftAuthorId(rapport, actor) {
  return rapport.owner_office_user_id || rapport.created_by_user_id || actor.id;
}

/** After Wali requests changes, fork an editable draft so submitted snapshots stay immutable. */
async function forkDraftIfSubmitted(rapport, actor) {
  const current = await RapportVersion.findByPk(rapport.current_version_id);
  if (!current?.submitted_at) return null;
  const draft = await createNextRapportVersion(
    rapport.id,
    current.data_json,
    draftAuthorId(rapport, actor),
  );
  await rapport.update({
    current_version_id: draft.id,
    updated_at: new Date(),
  });
  return draft;
}

/** Allow editing again after a submission without corrupting submitted snapshots. */
async function reopenDraftAfterSubmit(rapport, actor) {
  const current = await RapportVersion.findByPk(rapport.current_version_id);
  if (!current?.submitted_at) return null;
  if (rapport.rapportType?.versioning_mode === "versioned") {
    return forkDraftIfSubmitted(rapport, actor);
  }
  await RapportVersion.update(
    { submitted_at: null },
    { where: { id: current.id } },
  );
  return current;
}

async function submitRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Cannot submit");
    err.status = 409;
    throw err;
  }

  let versionId = rapport.current_version_id;
  let version = versionId ? await RapportVersion.findByPk(versionId) : null;
  if (!version) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }

  const isVersioned = rapport.rapportType?.versioning_mode === "versioned";
  if (isVersioned && version.submitted_at) {
    version = await createNextRapportVersion(
      rapport.id,
      version.data_json,
      actor.id,
    );
    versionId = version.id;
  }

  if (version.submitted_at) {
    const err = new Error("Cannot submit");
    err.status = 409;
    throw err;
  }

  if (rapport.rapportType?.content_kind === "table_grid" && versionId) {
    const slug = rapport.rapportType?.schema_json?.table_schema_slug;
    if (slug) {
      const { loadSchemaBySlug } = require("./tableGridService");
      const schema = await loadSchemaBySlug(slug);
      const version = await RapportVersion.findByPk(versionId);
      if (version) {
        await RapportVersion.update(
          {
            data_json: {
              ...(version.data_json || {}),
              schema_snapshot: {
                columns: schema.columns_json || [],
                layout_json: schema.layout_json || null,
              },
            },
          },
          { where: { id: versionId } },
        );
      }
    }
  }

  if (rapport.rapportType?.content_kind === "commune_list" && versionId) {
    const version = await RapportVersion.findByPk(versionId);
    const prevVersion = await RapportVersion.findOne({
      where: {
        rapport_id: rapport.id,
        submitted_at: { [Op.ne]: null },
        id: { [Op.ne]: versionId },
      },
      order: [["version_number", "DESC"]],
    });

    const currentCommunes = version.data_json?.communes || {};
    const prevCommunes = prevVersion?.data_json?.communes || {};
    const prevCommuneVersions = prevVersion?.commune_versions || {};

    const changedCodes = [];
    const nextCommuneVersions = { ...prevCommuneVersions };

    const allCodes = new Set([
      ...Object.keys(currentCommunes),
      ...Object.keys(prevCommunes),
    ]);

    for (const code of allCodes) {
      const curr = JSON.stringify(currentCommunes[code]);
      const prev = JSON.stringify(prevCommunes[code]);

      if (curr !== prev) {
        changedCodes.push(code);
        nextCommuneVersions[code] = versionId;
      }
    }

    await RapportVersion.update(
      {
        changed_commune_codes: changedCodes,
        commune_versions: nextCommuneVersions,
      },
      { where: { id: versionId } },
    );
  }

  const now = new Date();
  await RapportVersion.update(
    { submitted_at: now },
    { where: { id: versionId } },
  );
  await rapport.update({
    status: "submitted",
    current_version_id: versionId,
    updated_at: now,
    owner_office_user_id: actor.id,
  });
  await audit(
    actor.id,
    "RAPPORT_SUBMIT",
    { rapport_id: rapport.id, version_id: versionId },
    { req },
  );
  return getRapportDetail(rapport.id);
}

async function markUnderReview(id, actor) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) return null;
  if (rapport.status === "submitted") {
    await rapport.update({ status: "under_review", updated_at: new Date() });
  }
  return getRapportDetail(id);
}

async function waliRespond(id, data, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (
    !["submitted", "under_review", "changes_requested"].includes(rapport.status)
  ) {
    const err = new Error("Cannot respond");
    err.status = 409;
    throw err;
  }
  if (!rapport.current_version_id) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }
  const bodyText =
    data.decision === "viewed" ? "" : data.body_text?.trim() || "";
  if (data.decision === "changes_requested" && !bodyText) {
    const err = new Error("waliResponseRequired");
    err.status = 400;
    throw err;
  }

  let followUpStatus = "none";
  if (data.decision === "accepted") {
    followUpStatus = data.follow_up_status || "none";
    if (!["none", "pending", "completed"].includes(followUpStatus)) {
      const err = new Error("waliFollowUpInvalid");
      err.status = 400;
      throw err;
    }
  }

  const response = await WaliResponse.create({
    rapport_id: rapport.id,
    rapport_version_id: rapport.current_version_id,
    decision: data.decision,
    follow_up_status: followUpStatus,
    body_text: bodyText,
    scope: data.scope || "whole_rapport",
    scope_id: data.scope_id || null,
    created_by_user_id: actor.id,
  });

  let nextStatus = "acknowledged";
  if (data.decision === "changes_requested") nextStatus = "changes_requested";
  if (data.decision === "viewed") nextStatus = "acknowledged";

  if (data.decision === "changes_requested") {
    await reopenDraftAfterSubmit(rapport, actor);
  }

  await rapport.update({ status: nextStatus, updated_at: new Date() });

  const notifyUserId =
    rapport.owner_office_user_id || rapport.created_by_user_id;
  if (notifyUserId && data.decision === "accepted") {
    let messageKey = "waliAccepted";
    if (followUpStatus === "pending") messageKey = "waliAcceptedPending";
    if (followUpStatus === "completed") messageKey = "waliAcceptedCompleted";
    await Notification.create({
      user_id: notifyUserId,
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: messageKey,
    });
  } else if (notifyUserId && data.decision === "changes_requested") {
    await Notification.create({
      user_id: notifyUserId,
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliChangesRequested",
    });
  } else if (notifyUserId && data.decision === "viewed" && bodyText) {
    await Notification.create({
      user_id: notifyUserId,
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliFeedback",
    });
  }

  await audit(
    actor.id,
    "RAPPORT_WALI_RESPONSE",
    { rapport_id: rapport.id, decision: data.decision },
    { req },
  );
  return getRapportDetail(rapport.id);
}

async function listRapportVersions(rapportId) {
  const versions = await RapportVersion.findAll({
    where: { rapport_id: rapportId },
    order: [["version_number", "DESC"]],
    attributes: [
      "id",
      "version_number",
      "submitted_at",
      "created_at",
      "created_by_user_id",
    ],
  });
  return versions;
}

async function getRapportVersion(rapportId, versionId) {
  const version = await RapportVersion.findOne({
    where: { id: versionId, rapport_id: rapportId },
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
      {
        model: WaliResponse,
        as: "waliResponses",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "createdByUser", attributes: ["id", "name"] },
        ],
      },
    ],
  });
  if (!version) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await audit(null, "RAPPORT_VERSION_OPEN", {
    rapport_id: rapportId,
    version_id: versionId,
  });
  return version;
}

async function listNotifications(userId, unreadOnly = false) {
  const where = { user_id: userId };
  if (unreadOnly) where.read_at = null;
  return Notification.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: 50,
    include: [
      {
        model: Rapport,
        as: "rapport",
        attributes: ["id", "title", "status", "service_id"],
        required: false,
        include: [
          {
            model: RapportType,
            as: "rapportType",
            attributes: ["content_kind"],
          },
          {
            model: Service,
            as: "service",
            attributes: ["id", "slug", "name_ar", "name_fr"],
          },
        ],
      },
      {
        model: WaliResponse,
        as: "waliResponse",
        attributes: ["decision", "follow_up_status", "body_text"],
        required: false,
      },
      {
        model: WaliBroadcast,
        as: "broadcast",
        attributes: ["id", "title_ar", "title_fr"],
        required: false,
      },
    ],
  });
}

async function markNotificationRead(id, userId) {
  const n = await Notification.findOne({ where: { id, user_id: userId } });
  if (!n) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!n.read_at) await n.update({ read_at: new Date() });
  return n;
}

async function markRapportNotificationsRead(rapportId, userId) {
  await Notification.update(
    { read_at: new Date() },
    { where: { user_id: userId, rapport_id: rapportId, read_at: null } },
  );
}

async function hideRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (rapport.hidden_at) {
    const err = new Error("Already hidden");
    err.status = 409;
    throw err;
  }
  if (rapport.status === "draft") {
    const err = new Error("Cannot finish draft");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await rapport.update({ hidden_at: now, updated_at: now });
  await audit(actor.id, "RAPPORT_HIDE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function restoreRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!rapport.hidden_at) {
    const err = new Error("Not hidden");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await rapport.update({ hidden_at: null, updated_at: now });
  await audit(actor.id, "RAPPORT_RESTORE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function deleteRapportPermanently(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await sequelize.transaction(async (transaction) => {
    await rapport.update({ current_version_id: null }, { transaction });
    await Rapport.destroy({ where: { id: rapport.id }, transaction });
  });
  await audit(actor.id, "RAPPORT_DELETE", { rapport_id: Number(id) }, { req });
  return { ok: true };
}

module.exports = {
  listServices,
  listRapports,
  getRapportDetail,
  createRapport,
  updateRapportDraft,
  submitRapport,
  markUnderReview,
  waliRespond,
  listRapportVersions,
  getRapportVersion,
  listNotifications,
  markNotificationRead,
  markRapportNotificationsRead,
  hideRapport,
  restoreRapport,
  deleteRapportPermanently,
};
