const { Op } = require("sequelize");
const { RapportDocumentTemplate, RapportType } = require("../../db");
const { assertServiceAccess, assertRapportAccess } = require("./serviceAccessService");
const rapportService = require("./rapportService");
const { audit } = require("../../services/audit");
const { baseSlugFromNames, ensureUniqueSlug } = require("../../utils/slugUtils");
const { buildDocumentDefaultDataJson, buildFicheDefaultDataJson } = require("./documentDefaults");
const { findByPublicId, withPublicId, resolveNumericId } = require("../access/idResolver");
const { resolveNumericServiceId } = require("./serviceAccessService");

async function requireNumericServiceId(serviceId) {
  const numericServiceId = await resolveNumericServiceId(serviceId);
  if (!numericServiceId) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return numericServiceId;
}

const DOCUMENT_KINDS = new Set(["document_compose", "fiche_lecture"]);

function normalizeTypeIds(template) {
  const row = template?.toJSON ? template.toJSON() : template || {};
  const fromArray = Array.isArray(row.rapport_type_ids)
    ? row.rapport_type_ids.map((id) => Number(id)).filter((id) => id > 0)
    : [];
  if (fromArray.length) return [...new Set(fromArray)];
  if (row.rapport_type_id) return [Number(row.rapport_type_id)];
  return [];
}

function normalizeTypeIdsInput(data, existing) {
  if (data.rapport_type_ids !== undefined) {
    return Array.isArray(data.rapport_type_ids)
      ? [...new Set(data.rapport_type_ids.map((id) => Number(id)).filter((id) => id > 0))]
      : [];
  }
  if (data.rapport_type_id !== undefined) {
    return data.rapport_type_id ? [Number(data.rapport_type_id)] : [];
  }
  return normalizeTypeIds(existing || {});
}

function legacyTypeIdFromIds(typeIds) {
  return typeIds.length === 1 ? typeIds[0] : null;
}

function templateContentToDataJson(content) {
  const c = content || {};
  return {
    rich_html_ar: c.rich_html_ar || "<p></p>",
    rich_html_fr: c.rich_html_fr || "<p></p>",
    embedded_tables: Array.isArray(c.embedded_tables) ? c.embedded_tables : [],
    blocks: []
  };
}

function mergeHtml(existing, incoming) {
  const a = String(existing || "").trim();
  const b = String(incoming || "").trim();
  if (!a || a === "<p></p>") return b || "<p></p>";
  if (!b || b === "<p></p>") return a;
  return `${a}${a.endsWith("</p>") ? "" : ""}${b}`;
}

function applyTemplateContentToData(data, templateContent, mode = "replace") {
  const next = { ...data };
  const incoming = templateContentToDataJson(templateContent);
  if (mode === "append") {
    next.rich_html_ar = mergeHtml(next.rich_html_ar, incoming.rich_html_ar);
    next.rich_html_fr = mergeHtml(next.rich_html_fr, incoming.rich_html_fr);
    const existing = Array.isArray(next.embedded_tables) ? next.embedded_tables : [];
    next.embedded_tables = [...existing, ...(incoming.embedded_tables || [])];
  } else {
    next.rich_html_ar = incoming.rich_html_ar;
    next.rich_html_fr = incoming.rich_html_fr;
    next.embedded_tables = incoming.embedded_tables;
    next.blocks = [];
  }
  return next;
}

function templateMatchesType(template, rapportType) {
  const ids = normalizeTypeIds(template);
  if (ids.length && !ids.includes(Number(rapportType.id))) {
    return false;
  }
  if (template.content_kind && template.content_kind !== rapportType.content_kind) {
    return false;
  }
  return true;
}

function scopesOverlap(a, b) {
  if (a.content_kind && b.content_kind && a.content_kind !== b.content_kind) return false;
  const idsA = normalizeTypeIds(a);
  const idsB = normalizeTypeIds(b);
  if (!idsA.length || !idsB.length) return true;
  return idsA.some((id) => idsB.includes(id));
}

function defaultTemplateRank(template, rapportType) {
  const ids = normalizeTypeIds(template);
  if (ids.includes(Number(rapportType.id))) return 0;
  if (template.content_kind === rapportType.content_kind) return 1;
  if (!template.content_kind && !ids.length) return 2;
  return 99;
}

async function clearDefaultFlag(serviceId, { typeIds, contentKind, exceptId } = {}) {
  const numericServiceId = await requireNumericServiceId(serviceId);
  const rows = await RapportDocumentTemplate.findAll({
    where: {
      service_id: numericServiceId,
      is_default: true,
      ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
    },
  });
  const scope = {
    content_kind: contentKind || null,
    rapport_type_ids: typeIds || [],
    rapport_type_id: legacyTypeIdFromIds(typeIds || [])
  };
  for (const row of rows) {
    if (scopesOverlap(row, scope)) {
      await row.update({ is_default: false, updated_at: new Date() });
    }
  }
}

async function listForService(serviceId, user, { rapportTypeId, contentKind } = {}) {
  await assertServiceAccess(user, serviceId, "manage");
  const numericServiceId = await requireNumericServiceId(serviceId);
  const where = { service_id: numericServiceId };
  const rows = await RapportDocumentTemplate.findAll({
    where,
    order: [
      ["is_default", "DESC"],
      ["name_ar", "ASC"]
    ]
  });
  let matchTypeId = rapportTypeId;
  if (rapportTypeId) {
    matchTypeId = await resolveNumericId(RapportType, rapportTypeId);
  }
  return rows
    .filter((row) => {
      if (matchTypeId) {
        return templateMatchesType(row, {
          id: matchTypeId,
          content_kind: contentKind || row.content_kind,
        });
      }
      if (contentKind && row.content_kind && row.content_kind !== contentKind) {
        return false;
      }
      return true;
    })
    .map((row) => withPublicId(row));
}

async function listForRapportCreate(serviceId, user, rapportTypeId) {
  await assertServiceAccess(user, serviceId, "manage");
  const numericServiceId = await requireNumericServiceId(serviceId);
  const rapportType = await findByPublicId(RapportType, rapportTypeId);
  if (!rapportType || Number(rapportType.service_id) !== Number(numericServiceId)) {
    const err = new Error("Invalid document type");
    err.status = 400;
    throw err;
  }
  const rows = await RapportDocumentTemplate.findAll({
    where: { service_id: numericServiceId },
    order: [
      ["is_default", "DESC"],
      ["name_ar", "ASC"]
    ]
  });
  return rows.filter((row) => templateMatchesType(row, rapportType)).map((row) => withPublicId(row));
}

async function findDefaultTemplate(serviceId, rapportType) {
  const numericServiceId = await requireNumericServiceId(serviceId);
  const rows = await RapportDocumentTemplate.findAll({
    where: { service_id: numericServiceId, is_default: true }
  });
  const matches = rows.filter((row) => templateMatchesType(row, rapportType));
  matches.sort((a, b) => defaultTemplateRank(a, rapportType) - defaultTemplateRank(b, rapportType));
  return matches[0] || null;
}

async function getTemplateForService(serviceId, templateId, user) {
  await assertServiceAccess(user, serviceId, "manage");
  const numericServiceId = await requireNumericServiceId(serviceId);
  const row = await findByPublicId(RapportDocumentTemplate, templateId);
  if (!row || Number(row.service_id) !== Number(numericServiceId)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return withPublicId(row);
}

async function createForService(serviceId, data, user, req) {
  await assertServiceAccess(user, serviceId, "manage");
  const numericServiceId = await requireNumericServiceId(serviceId);
  let slug = data.slug?.trim();
  if (!slug) {
    const base = baseSlugFromNames(data.name_fr, data.name_ar, "doc-tpl");
    slug = await ensureUniqueSlug(base, async (s) => RapportDocumentTemplate.findOne({ where: { slug: s } }));
  } else {
    const existing = await RapportDocumentTemplate.findOne({ where: { slug } });
    if (existing) {
      const err = new Error("slugAlreadyExists");
      err.status = 409;
      throw err;
    }
  }
  if (data.is_default) {
    const typeIds = normalizeTypeIdsInput(data, null);
    await clearDefaultFlag(numericServiceId, {
      typeIds,
      contentKind: data.content_kind || null
    });
  }
  const typeIds = normalizeTypeIdsInput(data, null);
  const row = await RapportDocumentTemplate.create({
    service_id: numericServiceId,
    rapport_type_id: legacyTypeIdFromIds(typeIds),
    rapport_type_ids: typeIds,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    content_kind: data.content_kind || null,
    is_default: !!data.is_default,
    content_json: data.content_json || { rich_html_ar: "<p></p>", rich_html_fr: "<p></p>" },
    updated_at: new Date()
  });
  await audit(user.id, "DOCUMENT_TEMPLATE_CREATE", { template_id: row.id, service_id: numericServiceId }, { req });
  return withPublicId(row);
}

async function updateTemplate(templateId, data, user, req) {
  const row = await findByPublicId(RapportDocumentTemplate, templateId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  if (data.is_default) {
    const typeIds = normalizeTypeIdsInput(data, row);
    await clearDefaultFlag(row.service_id, {
      typeIds,
      contentKind: data.content_kind ?? row.content_kind,
      exceptId: row.id
    });
  }
  const typeIds =
    data.rapport_type_ids !== undefined || data.rapport_type_id !== undefined
      ? normalizeTypeIdsInput(data, row)
      : undefined;
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(typeIds !== undefined
      ? { rapport_type_ids: typeIds, rapport_type_id: legacyTypeIdFromIds(typeIds) }
      : {}),
    ...(data.content_kind !== undefined ? { content_kind: data.content_kind || null } : {}),
    ...(data.is_default != null ? { is_default: !!data.is_default } : {}),
    ...(data.content_json != null ? { content_json: data.content_json } : {}),
    updated_at: new Date()
  });
  await audit(user.id, "DOCUMENT_TEMPLATE_UPDATE", { template_id: row.id }, { req });
  return withPublicId(row);
}

async function deleteTemplate(templateId, user, req) {
  const row = await findByPublicId(RapportDocumentTemplate, templateId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  await row.destroy();
  await audit(user.id, "DOCUMENT_TEMPLATE_DELETE", { template_id: row.id }, { req });
}

async function resolveInitialDataJson(serviceId, rapportType, templateId) {
  const numericServiceId = await requireNumericServiceId(serviceId);
  if (templateId) {
    const tpl = await findByPublicId(RapportDocumentTemplate, templateId);
    if (!tpl || Number(tpl.service_id) !== Number(numericServiceId) || !templateMatchesType(tpl, rapportType)) {
      const err = new Error("Invalid template");
      err.status = 400;
      throw err;
    }
    return templateContentToDataJson(tpl.content_json);
  }
  const defaultTpl = await findDefaultTemplate(numericServiceId, rapportType);
  if (defaultTpl) return templateContentToDataJson(defaultTpl.content_json);
  if (rapportType.schema_json?.default_blocks?.length) {
    const blocks = rapportType.schema_json.default_blocks;
    // Prefer rich_html defaults when schema only has legacy blocks.
    const base =
      rapportType.content_kind === "fiche_lecture"
        ? buildFicheDefaultDataJson()
        : buildDocumentDefaultDataJson({
            titleAr: rapportType.name_ar,
            titleFr: rapportType.name_fr,
          });
    return { ...base, blocks };
  }
  if (rapportType.content_kind === "fiche_lecture") {
    return buildFicheDefaultDataJson();
  }
  return buildDocumentDefaultDataJson({
    titleAr: rapportType.name_ar,
    titleFr: rapportType.name_fr,
  });
}

async function applyTemplateToRapport(rapportId, templateId, mode, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  const kind = rapport.rapportType?.content_kind;
  if (!DOCUMENT_KINDS.has(kind)) {
    const err = new Error("Export not supported for this rapport type");
    err.status = 400;
    throw err;
  }
  const tpl = await findByPublicId(RapportDocumentTemplate, templateId);
  if (!tpl || Number(tpl.service_id) !== Number(rapport.service_id)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!templateMatchesType(tpl, rapport.rapportType)) {
    const err = new Error("Invalid template");
    err.status = 400;
    throw err;
  }
  const current = rapport.currentVersion?.data_json || {};
  const data = applyTemplateContentToData(current, tpl.content_json, mode === "append" ? "append" : "replace");
  return rapportService.updateRapportDraft(rapportId, { data_json: data }, actor, req);
}

module.exports = {
  DOCUMENT_KINDS,
  listForService,
  listForRapportCreate,
  createForService,
  updateTemplate,
  deleteTemplate,
  getTemplateForService,
  resolveInitialDataJson,
  applyTemplateToRapport,
  templateContentToDataJson,
  normalizeTypeIds
};
