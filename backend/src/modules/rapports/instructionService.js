const {
  WaliInstruction,
  WaliInstructionFile,
  WaliInstructionRecipient,
  UploadedFile,
  User,
  Notification
} = require("../../db");
const { saveUploadedFile, serializeFile, multerFileInput } = require("../../services/uploadService");
const { audit } = require("../../services/audit");
const { Op } = require("sequelize");
const { notifyUsers } = require("../notifications/notifyService");
const { assertCan, forbidden } = require("../access/assertCan");
const {
  findByPublicId,
  resolveNumericId,
  publicId,
  withPublicId,
} = require("../access/idResolver");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function serializeInstruction(row, extras = {}) {
  const i = row.toJSON ? row.toJSON() : row;
  return {
    id: publicId(i),
    title_ar: i.title_ar,
    title_fr: i.title_fr,
    body_ar: i.body_ar,
    body_fr: i.body_fr,
    created_at: i.created_at,
    updated_at: i.updated_at,
    created_by_user_id: i.created_by_user_id,
    createdByUser: i.createdByUser ? withPublicId(i.createdByUser) : i.createdByUser,
    files: (i.files || extras.files || []).map((f) => ({
      id: f.id,
      sort_order: f.sort_order,
      file: f.file ? serializeFile(f.file) : null
    })),
    recipients: (extras.recipients ?? i.recipients)?.map((r) => {
      const plain = r.toJSON ? r.toJSON() : r;
      return {
        ...plain,
        user: plain.user ? withPublicId(plain.user) : plain.user,
      };
    }),
    read_at: extras.read_at
  };
}

async function listOfficeUsers() {
  const users = await User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false, deleted_at: null },
    attributes: ["id", "uuid", "name", "username"],
    order: [["name", "ASC"]]
  });
  return users.map((u) => withPublicId(u));
}

async function resolveRecipientIds(body) {
  if (body.all_office === "1" || body.all_office === true || body.all_office === "true") {
    const users = await User.findAll({
      where: { role: "OFFICE_USER", is_blocked: false, deleted_at: null },
      attributes: ["id"],
    });
    return users.map((u) => u.id);
  }
  if (!body.recipient_ids) return [];
  const raw = typeof body.recipient_ids === "string" ? JSON.parse(body.recipient_ids) : body.recipient_ids;
  if (!Array.isArray(raw)) return [];
  const numericIds = [];
  for (const id of raw) {
    const nid = await resolveNumericId(User, id);
    if (nid) numericIds.push(nid);
  }
  return numericIds;
}

async function createInstruction({ files = [], body }, actor, req) {
  try {
    assertCan(actor, "rapports.instructions.create");
  } catch {
    if (actor.role !== "ADMIN") throw forbidden();
  }

  const title_ar = String(body.title_ar || "").trim();
  const title_fr = String(body.title_fr || "").trim();
  if (!title_ar && !title_fr) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }

  const recipientIds = await resolveRecipientIds(body);
  if (!recipientIds.length) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }

  const instruction = await WaliInstruction.create({
    title_ar: title_ar || title_fr,
    title_fr: title_fr || title_ar,
    body_ar: body.body_ar || null,
    body_fr: body.body_fr || null,
    created_by_user_id: actor.id,
    updated_at: new Date()
  });

  const fileRows = [];
  const preUploadedIds = Array.isArray(body.uploaded_file_ids)
    ? body.uploaded_file_ids.filter((id) => id != null && id !== "")
    : [];

  for (let idx = 0; idx < preUploadedIds.length; idx++) {
    const fileId = preUploadedIds[idx];
    const fileRow = await findByPublicId(UploadedFile, fileId);
    if (!fileRow || fileRow.uploaded_by_user_id !== actor.id) {
      const err = new Error("File not found");
      err.status = 400;
      throw err;
    }
    const link = await WaliInstructionFile.create({
      instruction_id: instruction.id,
      uploaded_file_id: fileRow.id,
      sort_order: idx,
    });
    fileRows.push(link);
  }

  for (let idx = 0; idx < files.length; idx++) {
    const f = files[idx];
    const input = multerFileInput(f);
    const serialized = await saveUploadedFile({
      ...input,
      rapportId: null,
      actor,
      req,
      startedAt: req.uploadStartedAt,
    });
    const numericFileId = await resolveNumericId(UploadedFile, serialized.id);
    const link = await WaliInstructionFile.create({
      instruction_id: instruction.id,
      uploaded_file_id: numericFileId,
      sort_order: preUploadedIds.length + idx,
    });
    fileRows.push(link);
  }

  await WaliInstructionRecipient.bulkCreate(
    recipientIds.map((user_id) => ({
      instruction_id: instruction.id,
      user_id,
      created_at: new Date()
    }))
  );

  await notifyUsers({
    userIds: recipientIds,
    instruction_id: instruction.id,
    message_key: "waliInstruction",
  });

  await audit(actor.id, "WALI_INSTRUCTION_CREATE", { instruction_id: instruction.id }, { req });
  return getInstruction(instruction.uuid || instruction.id, { asWali: true });
}

async function getInstruction(id, { userId = null, asWali = false, asChef = false } = {}) {
  const row = await findByPublicId(WaliInstruction, id, {
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "uuid", "name", "username"] },
      {
        model: WaliInstructionFile,
        as: "files",
        include: [{ model: UploadedFile, as: "file" }]
      },
      {
        model: WaliInstructionRecipient,
        as: "recipients",
        include: [{ model: User, as: "user", attributes: ["id", "uuid", "name", "username"] }]
      }
    ],
    order: [[{ model: WaliInstructionFile, as: "files" }, "sort_order", "ASC"]]
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  let read_at = null;
  if (userId && !asWali && !asChef) {
    const rec = row.recipients?.find((r) => Number(r.user_id) === Number(userId));
    if (!rec) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    if (!rec.read_at) {
      await rec.update({ read_at: new Date() });
      await Notification.update(
        { read_at: new Date() },
        { where: { user_id: userId, instruction_id: row.id, read_at: null } }
      );
      await audit(userId, "WALI_INSTRUCTION_READ", { instruction_id: row.id });
    }
    read_at = rec.read_at || new Date();
  }

  return serializeInstruction(row, { read_at });
}

async function listForWali(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const { rows, count } = await WaliInstruction.findAndCountAll({
    order: [["created_at", "DESC"]],
    offset,
    limit,
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "uuid", "name"] },
      {
        model: WaliInstructionFile,
        as: "files",
        include: [{ model: UploadedFile, as: "file" }]
      }
    ],
    distinct: true
  });
  return {
    instructions: rows.map((r) => serializeInstruction(r)),
    total: count,
    page,
    pageSize
  };
}

async function listForOffice(userId, query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const { rows, count } = await WaliInstruction.findAndCountAll({
    order: [["created_at", "DESC"]],
    offset,
    limit,
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "uuid", "name"] },
      {
        model: WaliInstructionFile,
        as: "files",
        include: [{ model: UploadedFile, as: "file" }]
      },
      {
        model: WaliInstructionRecipient,
        as: "recipients",
        where: { user_id: userId },
        required: true
      }
    ],
    distinct: true
  });
  return {
    instructions: rows.map((r) => {
      const rec = r.recipients?.[0];
      return serializeInstruction(r, { read_at: rec?.read_at || null });
    }),
    total: count,
    page,
    pageSize
  };
}

async function listForChef(query) {
  return listForWali(query);
}

async function deleteInstruction(id, actor, req) {
  try {
    assertCan(actor, "rapports.instructions.delete");
  } catch {
    if (actor.role !== "ADMIN") throw forbidden();
  }

  const row = await findByPublicId(WaliInstruction, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const instructionId = row.id;

  await Notification.destroy({ where: { instruction_id: instructionId } });
  await WaliInstructionRecipient.destroy({ where: { instruction_id: instructionId } });
  await WaliInstructionFile.destroy({ where: { instruction_id: instructionId } });
  await row.destroy();

  await audit(
    actor.id,
    "WALI_INSTRUCTION_DELETE",
    { instruction_id: instructionId, instruction_uuid: row.uuid || null },
    { req },
  );

  return { ok: true, id: publicId(row) };
}

module.exports = {
  listOfficeUsers,
  createInstruction,
  getInstruction,
  listForWali,
  listForOffice,
  listForChef,
  deleteInstruction,
};
