const { Op } = require("sequelize");
const {
  sequelize,
  GuideVideo,
  GuideVideoAudience,
  UploadedFile,
} = require("../../db");
const {
  saveUploadedFile,
  serializeFile,
  classifyMime,
  deleteUploadedFileById,
  multerFileInput,
  cleanupTempFile,
} = require("../../services/uploadService");
const { audit } = require("../../services/audit");
const { hasBilingualText } = require("../../validation/bilingual");
const {
  guideVideoCreateSchema,
  guideVideoPatchSchema
} = require("../../validation/schemas/adminCrud");
const {
  findByPublicId,
  resolveNumericId,
  publicId,
} = require("../access/idResolver");

const AUDIENCES = [
  "general",
  "ADMIN",
  "OFFICE_USER",
  "PRESIDENT_DAIRA",
  "PRESIDENT_COMMUNE",
  "DIRECTEUR_DIRECTION",
  "CHEF_CABINET",
  "WALI",
];
const PUBLIC_AUDIENCES = [
  "general",
  "OFFICE_USER",
  "PRESIDENT_DAIRA",
  "PRESIDENT_COMMUNE",
  "DIRECTEUR_DIRECTION",
  "CHEF_CABINET",
  "WALI",
];

const AUDIENCE_SORT_ORDER = new Map(AUDIENCES.map((a, i) => [a, i]));

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "on") return true;
  if (s === "false" || s === "0" || s === "off") return false;
  return fallback;
}

function sortAudiences(list) {
  return [...list].sort(
    (a, b) => (AUDIENCE_SORT_ORDER.get(a) ?? 99) - (AUDIENCE_SORT_ORDER.get(b) ?? 99)
  );
}

function audiencesFromRow(row) {
  const g = row.toJSON ? row.toJSON() : row;
  const raw = Array.isArray(g.audienceRows)
    ? g.audienceRows.map((r) => r.audience).filter(Boolean)
    : Array.isArray(g.audiences)
      ? g.audiences
      : [];
  return sortAudiences([...new Set(raw)]);
}

function serializeGuideVideo(row) {
  const g = row.toJSON ? row.toJSON() : row;
  return {
    id: publicId(g),
    title_ar: g.title_ar,
    title_fr: g.title_fr,
    description_ar: g.description_ar,
    description_fr: g.description_fr,
    audiences: audiencesFromRow(row),
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

function guideVideoIncludes() {
  return [
    { model: UploadedFile, as: "file" },
    {
      model: GuideVideoAudience,
      as: "audienceRows",
      attributes: ["audience"],
      required: false,
    },
  ];
}

async function listWhere(viewerRole, audienceFilter) {
  const and = [];

  if (viewerRole !== "ADMIN") {
    and.push(
      sequelize.literal(`NOT EXISTS (
        SELECT 1 FROM guide_video_audiences AS gva_admin
        WHERE gva_admin.guide_video_id = "GuideVideo"."id"
          AND gva_admin.audience = 'ADMIN'
      )`)
    );
  }

  if (audienceFilter) {
    if (viewerRole !== "ADMIN" && audienceFilter === "ADMIN") {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    and.push(
      sequelize.literal(`EXISTS (
        SELECT 1 FROM guide_video_audiences AS gva_tab
        WHERE gva_tab.guide_video_id = "GuideVideo"."id"
          AND gva_tab.audience = ${sequelize.escape(audienceFilter)}
      )`)
    );
  }

  if (!and.length) return {};
  return { [Op.and]: and };
}

async function listGuideVideos(query, viewerRole) {
  const { page, pageSize, audience } = parseListQuery(query);
  const where = await listWhere(viewerRole, audience);
  const { rows, count } = await GuideVideo.findAndCountAll({
    where,
    include: guideVideoIncludes(),
    order: [
      ["sort_order", "ASC"],
      ["created_at", "ASC"],
      ["id", "ASC"]
    ],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    distinct: true,
    col: "id",
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

async function resolveVideoFileId({ fileInput, uploadedFileId, actor, req, startedAt }) {
  if (fileInput?.sourcePath || fileInput?.buffer) {
    if (classifyMime(fileInput.mimeType) !== "video") {
      const err = new Error("Video file required");
      err.status = 400;
      throw err;
    }
    const fileRow = await saveUploadedFile({
      ...fileInput,
      rapportId: null,
      actor,
      req,
      startedAt,
    });
    await assertVideoFile(fileRow);
    return resolveNumericId(UploadedFile, fileRow.id);
  }
  if (uploadedFileId) {
    const row = await findByPublicId(UploadedFile, uploadedFileId);
    if (!row || row.uploaded_by_user_id !== actor.id) {
      const err = new Error("File not found");
      err.status = 400;
      throw err;
    }
    await assertVideoFile(serializeFile(row));
    return row.id;
  }
  const err = new Error("Video file required");
  err.status = 400;
  throw err;
}

function normalizeAudiencesInput(value) {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* comma-separated fallback */
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) return value;
  return [];
}

function normalizeGuideVideoBody(body) {
  const out = { ...(body || {}) };
  if (out.is_new !== undefined) out.is_new = parseBool(out.is_new, false);
  if (out.sort_order !== undefined && out.sort_order !== "") {
    out.sort_order = Number(out.sort_order);
  }
  if (out.uploaded_file_id !== undefined && out.uploaded_file_id !== "") {
    out.uploaded_file_id = String(out.uploaded_file_id);
  }
  if (out.audiences !== undefined) {
    out.audiences = normalizeAudiencesInput(out.audiences);
  } else if (out.audience !== undefined && out.audience !== "") {
    // Accept legacy single audience during transition
    out.audiences = [String(out.audience)];
    delete out.audience;
  }
  delete out.audience;
  return out;
}

async function replaceAudiences(guideVideoId, audiences, transaction) {
  const unique = sortAudiences([...new Set(audiences)]);
  await GuideVideoAudience.destroy({
    where: { guide_video_id: guideVideoId },
    transaction,
  });
  if (unique.length) {
    await GuideVideoAudience.bulkCreate(
      unique.map((audience) => ({
        guide_video_id: guideVideoId,
        audience,
      })),
      { transaction }
    );
  }
}

async function createGuideVideo({ fileInput, body }, actor, req) {
  const { requireSuperAdmin } = require("../organization/organizationService");
  requireSuperAdmin(actor);
  const parsed = guideVideoCreateSchema.safeParse(normalizeGuideVideoBody(body));
  if (!parsed.success) {
    const err = new Error(parsed.error.issues[0]?.message || "Validation failed");
    err.status = 400;
    throw err;
  }
  const data = parsed.data;

  const fileId = await resolveVideoFileId({
    fileInput,
    uploadedFileId: data.uploaded_file_id,
    actor,
    req,
    startedAt: req.uploadStartedAt,
  });

  const now = new Date();
  const row = await sequelize.transaction(async (transaction) => {
    const created = await GuideVideo.create(
      {
        title_ar: data.title_ar || "",
        title_fr: data.title_fr || "",
        description_ar: data.description_ar || null,
        description_fr: data.description_fr || null,
        uploaded_file_id: fileId,
        is_new: data.is_new,
        sort_order: data.sort_order ?? 0,
        created_by_user_id: actor.id,
        created_at: now,
        updated_at: now,
      },
      { transaction }
    );
    await replaceAudiences(created.id, data.audiences, transaction);
    return created;
  });

  await audit(actor.id, "GUIDE_VIDEO_CREATE", { guide_video_id: row.id }, { req });
  return getGuideVideoById(row.uuid || row.id, "ADMIN");
}

function hasAdminAudience(audiences) {
  return audiences.includes("ADMIN");
}

async function getGuideVideoById(id, viewerRole) {
  const row = await findByPublicId(GuideVideo, id, {
    include: guideVideoIncludes(),
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const audiences = audiencesFromRow(row);
  if (viewerRole !== "ADMIN" && hasAdminAudience(audiences)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return serializeGuideVideo(row);
}

async function patchGuideVideo(id, { fileInput, body }, actor, req) {
  const { requireSuperAdmin } = require("../organization/organizationService");
  requireSuperAdmin(actor);
  const row = await findByPublicId(GuideVideo, id, {
    include: guideVideoIncludes(),
  });
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const raw = normalizeGuideVideoBody(body);
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

  await sequelize.transaction(async (transaction) => {
    const previousFileId = row.uploaded_file_id;
    if (fileInput?.sourcePath || fileInput?.buffer || data.uploaded_file_id) {
      row.uploaded_file_id = await resolveVideoFileId({
        fileInput,
        uploadedFileId: data.uploaded_file_id,
        actor,
        req,
        startedAt: req.uploadStartedAt,
      });
      if (previousFileId && Number(previousFileId) !== Number(row.uploaded_file_id)) {
        await deleteUploadedFileById(previousFileId);
      }
    }

    if (data.title_ar !== undefined) row.title_ar = data.title_ar;
    if (data.title_fr !== undefined) row.title_fr = data.title_fr;
    if (data.description_ar !== undefined) row.description_ar = data.description_ar || null;
    if (data.description_fr !== undefined) row.description_fr = data.description_fr || null;
    if (data.is_new !== undefined) row.is_new = data.is_new;
    if (data.sort_order !== undefined) row.sort_order = data.sort_order;
    row.updated_at = new Date();
    await row.save({ transaction });

    if (data.audiences !== undefined) {
      await replaceAudiences(row.id, data.audiences, transaction);
    }
  });

  await audit(actor.id, "GUIDE_VIDEO_UPDATE", { guide_video_id: row.id }, { req });
  return getGuideVideoById(row.uuid || row.id, "ADMIN");
}

async function deleteGuideVideo(id, actor, req) {
  const { requireSuperAdmin } = require("../organization/organizationService");
  requireSuperAdmin(actor);
  const row = await findByPublicId(GuideVideo, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const fileId = row.uploaded_file_id;
  const numericId = row.id;
  await row.destroy();
  if (fileId) await deleteUploadedFileById(fileId);
  await audit(actor.id, "GUIDE_VIDEO_DELETE", { guide_video_id: numericId }, { req });
  return { ok: true };
}

function parseMultipartBody(req) {
  let body = {};
  try {
    body = req.body?.payload ? JSON.parse(req.body.payload) : { ...req.body };
  } catch {
    body = { ...req.body };
  }
  delete body.payload;
  return normalizeGuideVideoBody(body);
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
  parseBool,
  audiencesFromRow,
};
