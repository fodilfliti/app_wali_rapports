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

const BODY_MAX = 5000;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function serializeComment(row) {
  const c = row.toJSON ? row.toJSON() : row;
  const author = c.author || null;
  return {
    id: c.id,
    rapport_id: c.rapport_id,
    body_text: c.body_text,
    created_at: c.created_at,
    rapport_version_id: c.rapport_version_id,
    author: author
      ? {
          id: author.id,
          name: author.name,
          username: author.username,
          role: author.role
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
  const rapport = await Rapport.findByPk(rapportId);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return rapport;
}

async function assertCanDiscuss(rapportId, actor, { asWali = false } = {}) {
  if (asWali) {
    const rapportService = require("./rapportService");
    await rapportService.assertVisibleToWali(rapportId);
  } else if (actor.role === "OFFICE_USER" || actor.role === "ADMIN") {
    await assertRapportAccess(actor, rapportId, "view");
  } else if (actor.role === "CHEF_CABINET" || actor.role === "ADMIN") {
    await loadRapportOrThrow(rapportId);
  } else {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  const rapport = await loadRapportOrThrow(rapportId);
  if (!(await discussionAvailable(rapport))) {
    const err = new Error("discussionNotAvailable");
    err.status = 409;
    throw err;
  }
  return rapport;
}

async function resolveRecipientIds(rapport, authorId) {
  const ids = new Set();

  const reviewers = await User.findAll({
    where: {
      role: { [Op.in]: ["CHEF_CABINET", "WALI"] },
      is_blocked: false
    },
    attributes: ["id"]
  });
  for (const u of reviewers) ids.add(Number(u.id));

  const officeIds = [rapport.owner_office_user_id, rapport.created_by_user_id]
    .map((x) => (x != null ? Number(x) : null))
    .filter(Boolean);
  if (officeIds.length) {
    const officeUsers = await User.findAll({
      where: { id: officeIds, role: "OFFICE_USER", is_blocked: false },
      attributes: ["id"]
    });
    for (const u of officeUsers) ids.add(Number(u.id));
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
      where: { id: priorIds, role: "OFFICE_USER", is_blocked: false },
      attributes: ["id"]
    });
    for (const u of participants) ids.add(Number(u.id));
  }

  ids.delete(Number(authorId));
  return [...ids];
}

async function listComments(rapportId, actor, query, opts = {}) {
  await assertCanDiscuss(rapportId, actor, opts);
  await markCommentNotificationsRead(rapportId, actor.id);

  const { page, pageSize, offset, limit } = parsePagination(query);
  const { rows, count } = await RapportComment.findAndCountAll({
    where: { rapport_id: rapportId },
    order: [["created_at", "ASC"], ["id", "ASC"]],
    offset,
    limit,
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "name", "username", "role"]
      }
    ]
  });

  return {
    comments: rows.map(serializeComment),
    total: count,
    page,
    pageSize,
    discussion_available: true
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

  const comment = await RapportComment.create({
    rapport_id: rapport.id,
    author_user_id: actor.id,
    body_text: text,
    rapport_version_id: rapport.current_version_id || null,
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
    { rapport_id: rapport.id, comment_id: comment.id },
    { req }
  );

  const full = await RapportComment.findByPk(comment.id, {
    include: [{ model: User, as: "author", attributes: ["id", "name", "username", "role"] }]
  });
  return serializeComment(full);
}

async function markCommentNotificationsRead(rapportId, userId) {
  if (!userId) return;
  await Notification.update(
    { read_at: new Date() },
    {
      where: {
        user_id: userId,
        rapport_id: rapportId,
        message_key: "rapportComment",
        read_at: null
      }
    }
  );
}

async function getDiscussionMeta(rapportId) {
  const rapport = await loadRapportOrThrow(rapportId);
  return { discussion_available: await discussionAvailable(rapport) };
}

module.exports = {
  listComments,
  createComment,
  markCommentNotificationsRead,
  discussionAvailable,
  getDiscussionMeta,
  BODY_MAX
};
