const {
  WaliInstruction,
  WaliInstructionFile,
  WaliInstructionRecipient,
  UploadedFile,
  User,
  Notification
} = require("../../db");
const { saveUploadedBuffer, serializeFile } = require("../../services/uploadService");
const { audit } = require("../../services/audit");
const { Op } = require("sequelize");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function serializeInstruction(row, extras = {}) {
  const i = row.toJSON ? row.toJSON() : row;
  return {
    id: i.id,
    title_ar: i.title_ar,
    title_fr: i.title_fr,
    body_ar: i.body_ar,
    body_fr: i.body_fr,
    created_at: i.created_at,
    updated_at: i.updated_at,
    created_by_user_id: i.created_by_user_id,
    createdByUser: i.createdByUser,
    files: (i.files || extras.files || []).map((f) => ({
      id: f.id,
      sort_order: f.sort_order,
      file: f.file ? serializeFile(f.file) : null
    })),
    recipients: extras.recipients ?? i.recipients,
    read_at: extras.read_at
  };
}

async function listOfficeUsers() {
  return User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false },
    attributes: ["id", "name", "username"],
    order: [["name", "ASC"]]
  });
}

async function createInstruction({ files = [], body }, actor, req) {
  const title_ar = String(body.title_ar || "").trim();
  const title_fr = String(body.title_fr || "").trim();
  if (!title_ar && !title_fr) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }

  let recipientIds = [];
  if (body.all_office === "1" || body.all_office === true || body.all_office === "true") {
    const users = await listOfficeUsers();
    recipientIds = users.map((u) => u.id);
  } else if (body.recipient_ids) {
    const raw = typeof body.recipient_ids === "string" ? JSON.parse(body.recipient_ids) : body.recipient_ids;
    recipientIds = Array.isArray(raw) ? raw.map(Number).filter(Boolean) : [];
  }
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
  for (let idx = 0; idx < files.length; idx++) {
    const f = files[idx];
    const fileRow = await saveUploadedBuffer({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
      rapportId: null,
      actor,
      req
    });
    const link = await WaliInstructionFile.create({
      instruction_id: instruction.id,
      uploaded_file_id: fileRow.id,
      sort_order: idx
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

  await Notification.bulkCreate(
    recipientIds.map((user_id) => ({
      user_id,
      instruction_id: instruction.id,
      message_key: "waliInstruction",
      rapport_id: null
    }))
  );

  await audit(actor.id, "WALI_INSTRUCTION_CREATE", { instruction_id: instruction.id }, { req });
  return getInstruction(instruction.id, { asWali: true });
}

async function getInstruction(id, { userId = null, asWali = false, asChef = false } = {}) {
  const row = await WaliInstruction.findByPk(id, {
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "name", "username"] },
      {
        model: WaliInstructionFile,
        as: "files",
        include: [{ model: UploadedFile, as: "file" }]
      },
      {
        model: WaliInstructionRecipient,
        as: "recipients",
        include: [{ model: User, as: "user", attributes: ["id", "name", "username"] }]
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
        { where: { user_id: userId, instruction_id: id, read_at: null } }
      );
      await audit(userId, "WALI_INSTRUCTION_READ", { instruction_id: id });
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
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
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
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
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

module.exports = {
  listOfficeUsers,
  createInstruction,
  getInstruction,
  listForWali,
  listForOffice,
  listForChef
};
