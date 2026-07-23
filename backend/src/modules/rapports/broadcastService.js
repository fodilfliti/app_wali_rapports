const { Op } = require("sequelize");
const {
  WaliBroadcast,
  WaliBroadcastRecipient,
  WaliBroadcastComment,
  UploadedFile,
  User,
  Notification
} = require("../../db");
const { saveUploadedFile, serializeFile, multerFileInput } = require("../../services/uploadService");
const { audit } = require("../../services/audit");
const { hasBilingualText } = require("../../validation/bilingual");
const { notifyUsers } = require("../notifications/notifyService");
const { assertCan, forbidden } = require("../access/assertCan");
const {
  findByPublicId,
  resolveNumericId,
  publicId,
  withPublicId,
} = require("../access/idResolver");

function serializeBroadcast(row, extras = {}) {
  const b = row.toJSON ? row.toJSON() : row;
  return {
    id: publicId(b),
    title_ar: b.title_ar,
    title_fr: b.title_fr,
    message_ar: b.message_ar,
    message_fr: b.message_fr,
    allow_comments: b.allow_comments,
    created_at: b.created_at,
    created_by_user_id: b.created_by_user_id,
    file: b.file ? serializeFile(b.file) : extras.file || null,
    recipients: extras.recipients,
    comments: extras.comments,
    read_at: extras.read_at,
    stats: extras.stats
  };
}

const BROADCAST_RECIPIENT_ROLES = ["OFFICE_USER", "CHEF_CABINET"];

function isBroadcastRecipientRole(role) {
  return BROADCAST_RECIPIENT_ROLES.includes(role);
}

async function listOfficeUsers() {
  const users = await User.findAll({
    where: { role: { [Op.in]: BROADCAST_RECIPIENT_ROLES }, is_blocked: false, deleted_at: null },
    attributes: ["id", "uuid", "name", "username", "role"],
    order: [["name", "ASC"]]
  });
  return users.map((u) => withPublicId(u));
}

async function resolveRecipientIds(body) {
  if (body.all_users) {
    const users = await User.findAll({
      where: { role: { [Op.in]: BROADCAST_RECIPIENT_ROLES }, is_blocked: false, deleted_at: null },
      attributes: ["id"],
    });
    return users.map((u) => u.id);
  }
  const requested = body.recipient_user_ids || [];
  if (!requested.length) return [];
  const numericIds = [];
  for (const raw of requested) {
    const nid = await resolveNumericId(User, raw);
    if (nid) numericIds.push(nid);
  }
  if (!numericIds.length) return [];
  const users = await User.findAll({
    where: {
      id: { [Op.in]: numericIds },
      role: { [Op.in]: BROADCAST_RECIPIENT_ROLES },
      is_blocked: false,
      deleted_at: null,
    },
    attributes: ["id"]
  });
  return users.map((u) => u.id);
}

async function createBroadcast({ fileInput, body }, actor, req) {
  try {
    assertCan(actor, "broadcast.create");
  } catch {
    if (actor.role !== "ADMIN") throw forbidden();
  }

  let numericFileId;
  let fileSerialized;
  if (body.uploaded_file_id) {
    const fileModel = await findByPublicId(UploadedFile, body.uploaded_file_id);
    if (!fileModel || fileModel.uploaded_by_user_id !== actor.id) {
      const err = new Error("File not found");
      err.status = 400;
      throw err;
    }
    numericFileId = fileModel.id;
    fileSerialized = serializeFile(fileModel);
  } else if (fileInput?.sourcePath || fileInput?.buffer) {
    fileSerialized = await saveUploadedFile({
      ...fileInput,
      rapportId: null,
      actor,
      req,
      startedAt: req.uploadStartedAt,
    });
    numericFileId = await resolveNumericId(UploadedFile, fileSerialized.id);
  } else {
    const err = new Error("File required");
    err.status = 400;
    throw err;
  }

  const recipientIds = await resolveRecipientIds(body);
  if (!recipientIds.length) {
    const err = new Error("No recipients");
    err.status = 400;
    throw err;
  }
  if (!hasBilingualText(body.title_ar, body.title_fr)) {
    const err = new Error("bilingualLabelRequired");
    err.status = 400;
    throw err;
  }

  const broadcast = await WaliBroadcast.create({
    uploaded_file_id: numericFileId,
    title_ar: String(body.title_ar || "").slice(0, 200),
    title_fr: String(body.title_fr || "").slice(0, 200),
    message_ar: body.message_ar || null,
    message_fr: body.message_fr || null,
    allow_comments: body.allow_comments !== false,
    created_by_user_id: actor.id
  });

  await WaliBroadcastRecipient.bulkCreate(
    recipientIds.map((user_id) => ({ broadcast_id: broadcast.id, user_id }))
  );

  await notifyUsers({
    userIds: recipientIds,
    broadcast_id: broadcast.id,
    message_key: "waliBroadcast",
  });

  await audit(actor.id, "WALI_BROADCAST_CREATE", { broadcast_id: broadcast.id }, { req });
  return getBroadcastDetail(broadcast.uuid || broadcast.id, actor);
}

async function getRecipientRow(broadcastId, userId) {
  return WaliBroadcastRecipient.findOne({ where: { broadcast_id: broadcastId, user_id: userId } });
}

async function resolveBroadcastOrThrow(broadcastId) {
  const broadcast = await findByPublicId(WaliBroadcast, broadcastId, {
    include: [{ model: UploadedFile, as: "file" }]
  });
  if (!broadcast) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return broadcast;
}

async function getBroadcastDetail(broadcastId, actor) {
  const broadcast = await resolveBroadcastOrThrow(broadcastId);
  const numericId = broadcast.id;

  const recipients = await WaliBroadcastRecipient.findAll({
    where: { broadcast_id: numericId },
    include: [{ model: User, as: "user", attributes: ["id", "uuid", "name", "username"] }],
    order: [["id", "ASC"]]
  });

  const comments = await WaliBroadcastComment.findAll({
    where: { broadcast_id: numericId },
    include: [{ model: User, as: "user", attributes: ["id", "uuid", "name", "username", "role"] }],
    order: [["created_at", "ASC"]]
  });

  const stats = {
    total: recipients.length,
    read: recipients.filter((r) => r.read_at).length,
    unread: recipients.filter((r) => !r.read_at).length
  };

  let readAt = null;
  if (isBroadcastRecipientRole(actor.role)) {
    const mine = recipients.find((r) => Number(r.user_id) === Number(actor.id));
    if (!mine) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    readAt = mine.read_at || null;
  }

  return serializeBroadcast(broadcast, {
    recipients: recipients.map((r) => ({
      user: r.user ? withPublicId(r.user) : null,
      read_at: r.read_at
    })),
    comments: comments.map((c) => ({
      id: c.id,
      body_text: c.body_text,
      created_at: c.created_at,
      user: c.user ? withPublicId(c.user) : null
    })),
    stats,
    read_at: readAt
  });
}

async function listForWali() {
  const rows = await WaliBroadcast.findAll({
    order: [["created_at", "DESC"]],
    limit: 100,
    include: [{ model: UploadedFile, as: "file" }]
  });
  const out = [];
  for (const row of rows) {
    const recipients = await WaliBroadcastRecipient.findAll({ where: { broadcast_id: row.id } });
    out.push(
      serializeBroadcast(row, {
        stats: {
          total: recipients.length,
          read: recipients.filter((r) => r.read_at).length,
          unread: recipients.filter((r) => !r.read_at).length
        }
      })
    );
  }
  return out;
}

async function listForOfficeUser(userId) {
  const recipientRows = await WaliBroadcastRecipient.findAll({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
    include: [
      {
        model: WaliBroadcast,
        as: "broadcast",
        include: [{ model: UploadedFile, as: "file" }]
      }
    ]
  });
  return recipientRows.map((r) =>
    serializeBroadcast(r.broadcast, { read_at: r.read_at })
  );
}

async function markBroadcastRead(broadcastId, actor) {
  const broadcast = await findByPublicId(WaliBroadcast, broadcastId, { attributes: ["id"] });
  if (!broadcast) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const rec = await getRecipientRow(broadcast.id, actor.id);
  if (!rec) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (!rec.read_at) {
    await rec.update({ read_at: new Date() });
    await Notification.update(
      { read_at: new Date() },
      { where: { user_id: actor.id, broadcast_id: broadcast.id, read_at: null } }
    );
  }
  return getBroadcastDetail(broadcast.uuid || broadcast.id, actor);
}

async function addComment(broadcastId, bodyText, actor) {
  const broadcast = await findByPublicId(WaliBroadcast, broadcastId);
  if (!broadcast) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!broadcast.allow_comments) {
    const err = new Error("Comments disabled");
    err.status = 403;
    throw err;
  }
  if (isBroadcastRecipientRole(actor.role)) {
    const rec = await getRecipientRow(broadcast.id, actor.id);
    if (!rec) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
  }
  const text = String(bodyText || "").trim();
  if (!text) {
    const err = new Error("Comment required");
    err.status = 400;
    throw err;
  }
  await WaliBroadcastComment.create({
    broadcast_id: broadcast.id,
    user_id: actor.id,
    body_text: text
  });
  return getBroadcastDetail(broadcast.uuid || broadcast.id, actor);
}

async function notifyUnreadRecipients(broadcastId, actor) {
  const broadcast = await findByPublicId(WaliBroadcast, broadcastId);
  if (!broadcast || Number(broadcast.created_by_user_id) !== Number(actor.id)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  const unread = await WaliBroadcastRecipient.findAll({
    where: { broadcast_id: broadcast.id, read_at: null }
  });
  for (const r of unread) {
    const existing = await Notification.findOne({
      where: {
        user_id: r.user_id,
        broadcast_id: broadcast.id,
        message_key: "waliBroadcastReminder",
        read_at: null
      }
    });
    if (!existing) {
      await notifyUsers({
        userIds: [r.user_id],
        broadcast_id: broadcast.id,
        message_key: "waliBroadcastReminder",
      });
    }
  }
  return { reminded: unread.length };
}

module.exports = {
  createBroadcast,
  getBroadcastDetail,
  listForWali,
  listForOfficeUser,
  markBroadcastRead,
  addComment,
  notifyUnreadRecipients,
  listOfficeUsers
};
