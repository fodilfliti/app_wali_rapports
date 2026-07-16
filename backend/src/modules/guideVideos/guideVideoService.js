const { Op } = require("sequelize");
const { GuideVideo, UploadedFile } = require("../../db");
const { saveUploadedBuffer, serializeFile, classifyMime } = require("../../services/uploadService");
const { audit } = require("../../services/audit");
const { hasBilingualText } = require("../../validation/bilingual");
const {
  guideVideoCreateSchema,
  guideVideoPatchSchema
} = require("../../validation/schemas/adminCrud");

const AUDIENCES = ["general", "ADMIN", "OFFICE_USER", "CHEF_CABINET", "WALI"];
const PUBLIC_AUDIENCES = ["general", "OFFICE_USER", "CHEF_CABINET", "WALI"];

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "on") return true;
  if (s === "false" || s === "0" || s === "off") return false;
  return fallback;
}

function serializeGuideVideo(row) {
  const g = row.toJSON ? row.toJSON() : row;
  return {
    id: g.id,
    title_ar: g.title_ar,
    title_fr: g.title_fr,
    description_ar: g.description_ar,
    description_fr: g.description_fr,
    audience: g.audience,
    is_new: Boolean(g.is_new),
    sort_order: g.sort_order,
    created_by_user_id: g.created_by_user_id,
    created_at: g.created_at,
    updated_at: g.updated_at,
    file: g.file ? serializeFile(g.file) : null
  };
}

function parseListQuery(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  const audience = query.audience ? String(query.audience) : null;
  if (audience && !AUDIENCES.includes(audience)) {
    const err = new Error("Invalid audience");
    err.status = 400;
    throw err;
  }
  return { page, pageSize, audience };
}

function visibilityWhere(viewerRole, audienceFilter) {
  const where = {};
  if (viewerRole !== "ADMIN") {
    where.audience = { [Op.in]: PUBLIC_AUDIENCES };
  }
  if (audienceFilter) {
    if (viewerRole !== "ADMIN" && audienceFilter === "ADMIN") {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    where.audience = audienceFilter;
  }
  return where;
}

async function listGuideVideos(query, viewerRole) {
  const { page, pageSize, audience } = parseListQuery(query);
  const where = visibilityWhere(viewerRole, audience);
  const { rows, count } = await GuideVideo.findAndCountAll({
    where,
    include: [{ model: UploadedFile, as: "file" }],
    order: [
      ["is_new", "DESC"],
      ["sort_order", "ASC"],
      ["created_at", "DESC"]
    ],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return {
    videos: rows.map(serializeGuideVideo),
    total: count,
    page,
    pageSize
  };
}

async function assertVideoFile(fileRow) {
  if (!fileRow || fileRow.media_kind !== "video") {
    const err = new Error("Video file required");
    err.status = 400;
    throw err;
  }
}

async function createGuideVideo({ fileBuffer, originalName, mimeType, body }, actor, req) {
  const parsed = guideVideoCreateSchema.safeParse(body || {});
  if (!parsed.success) {
    const err = new Error(parsed.error.issues[0]?.message || "Validation failed");
    err.status = 400;
    throw err;
  }
  const data = parsed.data;

  if (classifyMime(mimeType) !== "video") {
    const err = new Error("Video file required");
    err.status = 400;
    throw err;
  }

  const fileRow = await saveUploadedBuffer({
    buffer: fileBuffer,
    originalName,
    mimeType,
    rapportId: null,
    actor,
    req
  });
  await assertVideoFile(fileRow);

  const now = new Date();
  const row = await GuideVideo.create({
    title_ar: data.title_ar || "",
    title_fr: data.title_fr || "",
    description_ar: data.description_ar || null,
    description_fr: data.description_fr || null,
    audience: data.audience,
    uploaded_file_id: fileRow.id,
    is_new: data.is_new,
    sort_order: data.sort_order ?? 0,
    created_by_user_id: actor.id,
    created_at: now,
    updated_at: now
  });

  await audit(actor.id, "GUIDE_VIDEO_CREATE", { guide_video_id: row.id }, { req });
  return getGuideVideoById(row.id, "ADMIN");
}

async function getGuideVideoById(id, viewerRole) {
  const row = await GuideVideo.findByPk(id, {
    include: [{ model: UploadedFile, as: "file" }]
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (viewerRole !== "ADMIN" && row.audience === "ADMIN") {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return serializeGuideVideo(row);
}

async function patchGuideVideo(id, { fileBuffer, originalName, mimeType, body }, actor, req) {
  const row = await GuideVideo.findByPk(id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const raw = { ...(body || {}) };
  if (raw.is_new !== undefined) raw.is_new = parseBool(raw.is_new, row.is_new);
  if (raw.sort_order !== undefined) raw.sort_order = Number(raw.sort_order);

  const parsed = guideVideoPatchSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error(parsed.error.issues[0]?.message || "Validation failed");
    err.status = 400;
    throw err;
  }
  const data = parsed.data;

  if (data.title_ar !== undefined || data.title_fr !== undefined) {
    const nextAr = data.title_ar !== undefined ? data.title_ar : row.title_ar;
    const nextFr = data.title_fr !== undefined ? data.title_fr : row.title_fr;
    if (!hasBilingualText(nextAr, nextFr)) {
      const err = new Error("bilingualLabelRequired");
      err.status = 400;
      throw err;
    }
  }

  if (fileBuffer) {
    if (classifyMime(mimeType) !== "video") {
      const err = new Error("Video file required");
      err.status = 400;
      throw err;
    }
    const fileRow = await saveUploadedBuffer({
      buffer: fileBuffer,
      originalName,
      mimeType,
      rapportId: null,
      actor,
      req
    });
    await assertVideoFile(fileRow);
    row.uploaded_file_id = fileRow.id;
  }

  if (data.title_ar !== undefined) row.title_ar = data.title_ar;
  if (data.title_fr !== undefined) row.title_fr = data.title_fr;
  if (data.description_ar !== undefined) row.description_ar = data.description_ar || null;
  if (data.description_fr !== undefined) row.description_fr = data.description_fr || null;
  if (data.audience !== undefined) row.audience = data.audience;
  if (data.is_new !== undefined) row.is_new = data.is_new;
  if (data.sort_order !== undefined) row.sort_order = data.sort_order;
  row.updated_at = new Date();
  await row.save();

  await audit(actor.id, "GUIDE_VIDEO_UPDATE", { guide_video_id: row.id }, { req });
  return getGuideVideoById(row.id, "ADMIN");
}

async function deleteGuideVideo(id, actor, req) {
  const row = await GuideVideo.findByPk(id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await row.destroy();
  await audit(actor.id, "GUIDE_VIDEO_DELETE", { guide_video_id: Number(id) }, { req });
  return { ok: true };
}

function parseMultipartBody(req) {
  let body = {};
  try {
    body = req.body?.payload ? JSON.parse(req.body.payload) : { ...req.body };
  } catch {
    body = { ...req.body };
  }
  if (body.is_new !== undefined) body.is_new = parseBool(body.is_new, false);
  if (body.sort_order !== undefined && body.sort_order !== "") {
    body.sort_order = Number(body.sort_order);
  }
  delete body.payload;
  return body;
}

module.exports = {
  AUDIENCES,
  PUBLIC_AUDIENCES,
  listGuideVideos,
  createGuideVideo,
  patchGuideVideo,
  deleteGuideVideo,
  getGuideVideoById,
  parseMultipartBody,
  parseBool
};
