const { Op } = require("sequelize");
const {
  Service,
  Department,
  RapportType,
  Rapport,
  RapportVersion,
  WaliResponse,
  Notification,
  User,
  WaliBroadcast
} = require("../../db");
const { audit } = require("../../services/audit");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

async function listServices() {
  return Service.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] },
      { model: RapportType, as: "rapportTypes", attributes: ["id", "slug", "name_ar", "name_fr", "layout_kind", "versioning_mode", "content_kind"] }
    ]
  });
}

async function listRapports(query, opts = {}) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = {};
  if (query.status) where.status = query.status;
  if (query.service_id) where.service_id = query.service_id;
  if (opts.inboxOnly) {
    where.status = { [Op.in]: ["submitted", "under_review", "changes_requested", "acknowledged"] };
  }
  const { rows, count } = await Rapport.findAndCountAll({
    where,
    order: [["updated_at", "DESC"]],
    offset,
    limit,
    include: [
      { model: Service, as: "service", attributes: ["id", "slug", "name_ar", "name_fr"] },
      { model: RapportType, as: "rapportType", attributes: ["id", "slug", "layout_kind", "versioning_mode"] },
      { model: User, as: "createdByUser", attributes: ["id", "name", "username"] }
    ]
  });
  return { rapports: rows, total: count, page, pageSize };
}

async function getRapportDetail(id) {
  const rapport = await Rapport.findByPk(id, {
    include: [
      { model: Service, as: "service" },
      { model: RapportType, as: "rapportType" },
      { model: RapportVersion, as: "currentVersion" },
      { model: RapportVersion, as: "versions" },
      { model: WaliResponse, as: "waliResponses", order: [["created_at", "DESC"]] },
      { model: User, as: "createdByUser", attributes: ["id", "name"] }
    ]
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const plain = rapport.toJSON ? rapport.toJSON() : rapport;
  if (!plain.currentVersion && plain.current_version_id && plain.versions?.length) {
    plain.currentVersion = plain.versions.find((v) => v.id === plain.current_version_id) || plain.versions[0];
  }
  return plain;
}

async function createRapport(data, actor, req) {
  const rapportType = await RapportType.findByPk(data.rapport_type_id);
  if (!rapportType || Number(rapportType.service_id) !== Number(data.service_id)) {
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
          : data.owner_office_user_id || actor.id
  });
  const version = await RapportVersion.create({
    rapport_id: rapport.id,
    version_number: 1,
    data_json: data.data_json || {},
    created_by_user_id: actor.id
  });
  await rapport.update({ current_version_id: version.id });
  await audit(actor.id, "RAPPORT_CREATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function updateRapportDraft(id, data, actor, req) {
  const rapport = await Rapport.findByPk(id, { include: [{ model: RapportVersion, as: "currentVersion" }] });
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
  await rapport.update({
    ...(data.title != null ? { title: data.title } : {}),
    ...(data.reference_date !== undefined ? { reference_date: data.reference_date } : {}),
    updated_at: new Date()
  });
  if (data.data_json && rapport.current_version_id) {
    await RapportVersion.update({ data_json: data.data_json }, { where: { id: rapport.current_version_id } });
  }
  await audit(actor.id, "RAPPORT_UPDATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function submitRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id, { include: [{ model: RapportType, as: "rapportType" }] });
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
  if (rapport.rapportType?.versioning_mode === "versioned" && rapport.status === "changes_requested") {
    const last = await RapportVersion.findOne({ where: { rapport_id: rapport.id }, order: [["version_number", "DESC"]] });
    const nextNum = (last?.version_number || 0) + 1;
    const prev = last ? await RapportVersion.findByPk(last.id) : null;
    const version = await RapportVersion.create({
      rapport_id: rapport.id,
      version_number: nextNum,
      data_json: prev?.data_json || {},
      created_by_user_id: actor.id
    });
    versionId = version.id;
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
                layout_json: schema.layout_json || null
              }
            }
          },
          { where: { id: versionId } }
        );
      }
    }
  }

  const now = new Date();
  await RapportVersion.update({ submitted_at: now }, { where: { id: versionId } });
  await rapport.update({ status: "submitted", current_version_id: versionId, updated_at: now, owner_office_user_id: actor.id });
  await audit(actor.id, "RAPPORT_SUBMIT", { rapport_id: rapport.id, version_id: versionId }, { req });
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
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!["submitted", "under_review", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Cannot respond");
    err.status = 409;
    throw err;
  }
  if (!rapport.current_version_id) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }
  const bodyText = data.body_text?.trim() || (data.decision === "viewed" ? "" : "");
  if (data.decision === "changes_requested" && !bodyText) {
    const err = new Error("waliResponseRequired");
    err.status = 400;
    throw err;
  }

  const response = await WaliResponse.create({
    rapport_id: rapport.id,
    rapport_version_id: rapport.current_version_id,
    decision: data.decision,
    body_text: bodyText || "—",
    scope: data.scope || "whole_rapport",
    scope_id: data.scope_id || null,
    created_by_user_id: actor.id
  });

  let nextStatus = "acknowledged";
  if (data.decision === "changes_requested") nextStatus = "changes_requested";
  if (data.decision === "viewed") nextStatus = "acknowledged";

  await rapport.update({ status: nextStatus, updated_at: new Date() });

  const notifyUserId = rapport.owner_office_user_id || rapport.created_by_user_id;
  if (notifyUserId && data.decision !== "viewed") {
    await Notification.create({
      user_id: notifyUserId,
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: data.decision === "accepted" ? "waliAccepted" : "waliChangesRequested"
    });
  } else if (notifyUserId && data.decision === "viewed" && bodyText) {
    await Notification.create({
      user_id: notifyUserId,
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliFeedback"
    });
  }

  await audit(actor.id, "RAPPORT_WALI_RESPONSE", { rapport_id: rapport.id, decision: data.decision }, { req });
  return getRapportDetail(rapport.id);
}

async function listRapportVersions(rapportId) {
  const versions = await RapportVersion.findAll({
    where: { rapport_id: rapportId },
    order: [["version_number", "DESC"]],
    attributes: ["id", "version_number", "submitted_at", "created_at", "created_by_user_id"]
  });
  return versions;
}

async function getRapportVersion(rapportId, versionId) {
  const version = await RapportVersion.findOne({
    where: { id: versionId, rapport_id: rapportId },
    include: [{ model: User, as: "createdByUser", attributes: ["id", "name"] }]
  });
  if (!version) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await audit(null, "RAPPORT_VERSION_OPEN", { rapport_id: rapportId, version_id: versionId });
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
          { model: RapportType, as: "rapportType", attributes: ["content_kind"] },
          { model: Service, as: "service", attributes: ["id", "slug", "name_ar", "name_fr"] }
        ]
      },
      { model: WaliResponse, as: "waliResponse", attributes: ["decision", "body_text"], required: false },
      {
        model: WaliBroadcast,
        as: "broadcast",
        attributes: ["id", "title_ar", "title_fr"],
        required: false
      }
    ]
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
  markNotificationRead
};
