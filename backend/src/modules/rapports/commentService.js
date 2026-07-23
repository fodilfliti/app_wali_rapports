const { Op } = require("sequelize");
const {
  Rapport,
  RapportComment,
  RapportVersion,
  User,
  Notification
} = require("../../db");
const { audit } = require("../../services/audit");
const { assertRapportAccess } = require("./serviceAccessService");
const { notifyUsers } = require("../notifications/notifyService");
const { findByPublicId, publicId } = require("../access/idResolver");

const BODY_MAX = 5000;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function serializeComment(row) {
  const c = row.toJSON ? row.toJSON() : row;
  const author = c.author || null;
  const deleted = Boolean(author?.deleted_at);
  return {
    id: publicId(c),
    rapport_id: c.rapport?.uuid ? String(c.rapport.uuid) : c.rapport_id,
    body_text: c.body_text,
    created_at: c.created_at,
    rapport_version_id: c.rapportVersion
      ? publicId(c.rapportVersion)
      : c.rapport_version_id,
    author: author
      ? {
          id: publicId(author),
          name: deleted ? null : author.name,
          username: deleted ? null : author.username,
          role: author.role,
          is_deleted: deleted,
        }
      : null
  };
}

async function discussionAvailable(rapport) {
  if (!rapport) return false;
  if (["pending_chef", "submitted", "under_review", "changes_requested", "acknowledged"].includes(rapport.status)) {
    return true;
  }
  const submitted = await RapportVersion.count({
    where: { rapport_id: rapport.id, submitted_at: { [Op.ne]: null } }
  });
  return submitted > 0;
}

async function loadRapportOrThrow(rapportId) {
  const rapport = await findByPublicId(Rapport, rapportId);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return rapport;
}

async function assertCanDiscuss(rapportId, actor, { asWali = false } = {}) {
  const { assertCan, forbidden } = require("../access/assertCan");
  try {
    assertCan(actor, "rapport.comment");
  } catch {
    if (actor.role !== "ADMIN") throw forbidden();
  }
  if (asWali) {
    const rapportService = require("./rapportService");
    await rapportService.assertVisibleToWali(rapportId);
  } else if (actor.role === "OFFICE_USER" || actor.role === "ADMIN") {
    await assertRapportAccess(actor, rapportId, "view");
  } else if (actor.role === "CHEF_CABINET") {
    const rapportService = require("./rapportService");
    await rapportService.assertVisibleToChef(rapportId);
  } else {
    throw forbidden();
  }
  const rapport = await loadRapportOrThrow(rapportId);
  if (!(await discussionAvailable(rapport))) {
    const err = new Error("discussionNotAvailable");
    err.status = 409;
    throw err;
  }
  return rapport;
}

/** Resolve version for list; must belong to the rapport. Default = current. */
async function resolveListVersionId(rapport, queryVersionId) {
  const currentId =
    rapport.current_version_id != null
      ? Number(rapport.current_version_id)
      : null;
  if (queryVersionId == null || queryVersionId === "") {
    if (!currentId) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    return currentId;
  }
  const { resolveNumericVersionId } = require("./rapportService");
  const requested = await resolveNumericVersionId(queryVersionId);
  if (requested == null) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const row = await RapportVersion.findOne({
    where: { id: requested, rapport_id: rapport.id },
    attributes: ["id"],
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return Number(row.id);
}

async function resolveRecipientIds(rapport, authorId) {
  const ids = new Set();

  const reviewers = await User.findAll({
    where: {
      role: { [Op.in]: ["CHEF_CABINET", "WALI"] },
      is_blocked: false,
      deleted_at: null,
    },
    attributes: ["id"],
  });
  for (const u of reviewers) ids.add(Number(u.id));

  const officeIds = [rapport.owner_office_user_id, rapport.created_by_user_id]
    .map((x) => (x != null ? Number(x) : null))
    .filter(Boolean);
  if (officeIds.length) {
    const officeUsers = await User.findAll({
      where: { id: officeIds, role: "OFFICE_USER", is_blocked: false, deleted_at: null },
      attributes: ["id"]
    });
    for (const u of officeUsers) ids.add(Number(u.id));
  }

  // Co-editors with manage on the same service hear discussion too.
  const {
    getOfficeUserIdsWithServiceAccess,
  } = require("./serviceAccessService");
  if (rapport.service_id) {
    const manageGrantees = await getOfficeUserIdsWithServiceAccess(
      Number(rapport.service_id),
      { minLevel: "manage" },
    );
    for (const id of manageGrantees) ids.add(id);
  }

  const priorAuthors = await RapportComment.findAll({
    where: { rapport_id: rapport.id },
    attributes: ["author_user_id"],
    group: ["author_user_id"],
    raw: true
  });
  const priorIds = priorAuthors.map((r) => Number(r.author_user_id)).filter(Boolean);
  if (priorIds.length) {
    const participants = await User.findAll({
      where: { id: priorIds, role: "OFFICE_USER", is_blocked: false, deleted_at: null },
      attributes: ["id"]
    });
    for (const u of participants) ids.add(Number(u.id));
  }

  ids.delete(Number(authorId));
  return [...ids];
}

async function listComments(rapportId, actor, query, opts = {}) {
  const rapport = await assertCanDiscuss(rapportId, actor, opts);
  await markCommentNotificationsRead(rapport.id, actor.id);

  const versionId = await resolveListVersionId(rapport, query.versionId);
  const currentId =
    rapport.current_version_id != null
      ? Number(rapport.current_version_id)
      : null;
  const canComment = Boolean(currentId && versionId === currentId);

  const { page, pageSize, offset, limit } = parsePagination(query);
  const { rows, count } = await RapportComment.findAndCountAll({
    where: { rapport_id: rapport.id, rapport_version_id: versionId },
    order: [["created_at", "ASC"], ["id", "ASC"]],
    offset,
    limit,
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "uuid", "name", "username", "role", "deleted_at"]
      }
    ]
  });

  return {
    comments: rows.map(serializeComment),
    total: count,
    page,
    pageSize,
    discussion_available: true,
    can_comment: canComment,
    rapport_version_id: versionId
      ? publicId(
          (await RapportVersion.findByPk(versionId, {
            attributes: ["id", "uuid"],
          })) || { id: versionId },
        )
      : null,
  };
}

async function createComment(rapportId, bodyText, actor, req, opts = {}) {
  const rapport = await assertCanDiscuss(rapportId, actor, opts);
  const text = String(bodyText || "").trim();
  if (!text) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }
  if (text.length > BODY_MAX) {
    const err = new Error("validationMaxLength");
    err.status = 400;
    throw err;
  }

  const currentId =
    rapport.current_version_id != null
      ? Number(rapport.current_version_id)
      : null;
  if (!currentId) {
    const err = new Error("discussionNotAvailable");
    err.status = 409;
    throw err;
  }

  const rawBodyVersion =
    opts.versionId != null && opts.versionId !== ""
      ? opts.versionId
      : req?.validatedBody?.versionId != null
        ? req.validatedBody.versionId
        : req?.body?.versionId != null && req.body.versionId !== ""
          ? req.body.versionId
          : null;
  let bodyVersion = null;
  if (rawBodyVersion != null && rawBodyVersion !== "") {
    const { resolveNumericVersionId } = require("./rapportService");
    bodyVersion = await resolveNumericVersionId(rawBodyVersion);
  }
  if (
    bodyVersion != null &&
    Number.isFinite(bodyVersion) &&
    bodyVersion !== currentId
  ) {
    const err = new Error("discussionReadOnly");
    err.status = 409;
    throw err;
  }

  const comment = await RapportComment.create({
    rapport_id: rapport.id,
    author_user_id: actor.id,
    body_text: text,
    rapport_version_id: currentId,
    created_at: new Date()
  });

  const recipientIds = await resolveRecipientIds(rapport, actor.id);
  if (recipientIds.length) {
    await notifyUsers({
      userIds: recipientIds,
      rapport_id: rapport.id,
      comment_id: comment.id,
      message_key: "rapportComment",
    });
  }

  await audit(
    actor.id,
    "RAPPORT_COMMENT_CREATE",
    {
      rapport_id: rapport.id,
      comment_id: comment.id,
      rapport_version_id: currentId,
    },
    { req }
  );

  const full = await RapportComment.findByPk(comment.id, {
    include: [{ model: User, as: "author", attributes: ["id", "uuid", "name", "username", "role"] }]
  });
  return serializeComment(full);
}

async function markCommentNotificationsRead(rapportId, userId) {
  if (!userId) return;
  const rapport = await loadRapportOrThrow(rapportId);
  await Notification.update(
    { read_at: new Date() },
    {
      where: {
        user_id: userId,
        rapport_id: rapport.id,
        message_key: "rapportComment",
        read_at: null
      }
    }
  );
}

async function getDiscussionMeta(rapportId) {
  const rapport = await loadRapportOrThrow(rapportId);
  const available = await discussionAvailable(rapport);
  const currentId =
    rapport.current_version_id != null
      ? Number(rapport.current_version_id)
      : null;
  return {
    discussion_available: available,
    can_comment: Boolean(available && currentId),
    rapport_version_id: currentId,
  };
}

module.exports = {
  listComments,
  createComment,
  markCommentNotificationsRead,
  discussionAvailable,
  getDiscussionMeta,
  BODY_MAX
};
