const { Op } = require("sequelize");
const {
  Service,
  RapportType,
  RapportTableSchema,
  Rapport,
  RapportDocumentTemplate,
} = require("../../db");
const { audit } = require("../../services/audit");
const {
  baseSlugFromNames,
  ensureUniqueSlug,
  rapportTypeSlugFromNames,
} = require("../../utils/slugUtils");
const {
  remapDraftRapportsForSchemaChange,
} = require("./schemaRowRemapService");
const { hasBilingualText } = require("../../validation/bilingual");
const { findByPublicId, resolveNumericId, withPublicId } = require("../access/idResolver");

async function loadServiceWithTypes(serviceId) {
  const service = await findByPublicId(Service, serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return service;
}

const COLUMN_TYPES = new Set([
  "text",
  "number",
  "date",
  "choice",
  "commune_ref",
  "formula",
]);

function validateColumns(columns) {
  if (!Array.isArray(columns) || !columns.length) {
    const err = new Error("columnsRequired");
    err.status = 400;
    throw err;
  }
  const keys = new Set();
  for (const col of columns) {
    if (!col.key || !COLUMN_TYPES.has(col.type)) {
      const err = new Error("invalidColumn");
      err.status = 400;
      throw err;
    }
    if (keys.has(col.key)) {
      const err = new Error("duplicateColumnKey");
      err.status = 400;
      throw err;
    }
    keys.add(col.key);
    if (!hasBilingualText(col.label_ar, col.label_fr)) {
      const err = new Error("bilingualLabelRequired");
      err.status = 400;
      throw err;
    }
    if (col.type === "choice") {
      if (!Array.isArray(col.choices) || col.choices.length < 1) {
        const err = new Error("choiceOptionsRequired");
        err.status = 400;
        throw err;
      }
      for (const ch of col.choices) {
        if (!hasBilingualText(ch.label_ar, ch.label_fr)) {
          const err = new Error("bilingualLabelRequired");
          err.status = 400;
          throw err;
        }
      }
    }
  }
}

function buildSchemaJsonForType(contentKind, body) {
  if (contentKind === "table_grid") {
    const slug = body.table_schema_slug || body.schema_json?.table_schema_slug;
    if (!slug) {
      const err = new Error("tableSchemaSlugRequired");
      err.status = 400;
      throw err;
    }
    return {
      table_schema_slug: slug,
      table_key: body.table_key || body.schema_json?.table_key || "main",
    };
  }
  if (contentKind === "commune_list") {
    const communeKind = body.commune_content_kind || "complex";
    if (communeKind !== "table") {
      return body.schema_json || null;
    }
    const slug = body.table_schema_slug || body.schema_json?.table_schema_slug;
    if (!slug) {
      const err = new Error("tableSchemaSlugRequired");
      err.status = 400;
      throw err;
    }
    return {
      table_schema_slug: slug,
      table_key: body.table_key || body.schema_json?.table_key || "main",
    };
  }
  if (contentKind === "document_compose" || contentKind === "fiche_lecture") {
    return body.default_blocks ? { default_blocks: body.default_blocks } : null;
  }
  return body.schema_json || null;
}

async function listTableSchemas(query = {}) {
  const where = {};
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  if (query.service_id) {
    const serviceId = await resolveNumericId(Service, query.service_id);
    if (!serviceId) {
      return { schemas: [], total: 0, page, pageSize: limit };
    }
    const includeShared =
      query.include_shared === "1" || query.include_shared === "true";
    if (includeShared) {
      where[Op.or] = [{ service_id: serviceId }, { service_id: null }];
    } else {
      const types = await RapportType.findAll({
        where: { service_id: serviceId, content_kind: "table_grid" },
        attributes: ["schema_json"],
      });
      const linkedSlugs = types
        .map((row) => row.schema_json?.table_schema_slug)
        .filter(Boolean);
      const scope = [{ service_id: serviceId }];
      if (linkedSlugs.length) scope.push({ slug: { [Op.in]: linkedSlugs } });
      where[Op.or] = scope;
    }
  }

  if (query.q) {
    const search = {
      [Op.or]: [
        { slug: { [Op.iLike]: `%${query.q}%` } },
        { name_ar: { [Op.iLike]: `%${query.q}%` } },
        { name_fr: { [Op.iLike]: `%${query.q}%` } },
      ],
    };
    if (where[Op.or]) {
      where[Op.and] = [{ [Op.or]: where[Op.or] }, search];
      delete where[Op.or];
    } else {
      Object.assign(where, search);
    }
  }

  const { rows, count } = await RapportTableSchema.findAndCountAll({
    where,
    limit,
    offset,
    order: [["name_ar", "ASC"]],
    include: [
      {
        model: Service,
        as: "service",
        attributes: ["id", "uuid", "slug", "name_ar", "name_fr"],
        required: false,
      },
    ],
  });

  return {
    schemas: rows.map((row) => {
      const plain = withPublicId(row);
      if (plain.service) {
        plain.service = withPublicId(plain.service);
        plain.service_id = plain.service.id;
      }
      return plain;
    }),
    total: count,
    page,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}

async function createTableSchema(data, actor, req) {
  validateColumns(data.columns);
  let slug = data.slug?.trim();
  if (!slug) {
    const base = baseSlugFromNames(data.name_fr, data.name_ar, "schema");
    slug = await ensureUniqueSlug(base, async (s) =>
      RapportTableSchema.findOne({ where: { slug: s } }),
    );
  }
  let serviceId = null;
  if (data.service_id) {
    serviceId = await resolveNumericId(Service, data.service_id);
    if (!serviceId) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
  }
  const row = await RapportTableSchema.create({
    service_id: serviceId,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    columns_json: data.columns,
    layout_json: data.layout_json ?? null,
    is_system: false,
  });
  await audit(
    actor.id,
    "TABLE_SCHEMA_CREATE",
    { schema_id: row.id, slug: row.slug },
    { req },
  );
  return withPublicId(row);
}

async function updateTableSchema(id, data, actor, req) {
  const row = await findByPublicId(RapportTableSchema, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (data.columns) validateColumns(data.columns);
  const oldColumns = row.columns_json || [];
  if (data.columns) {
    await remapDraftRapportsForSchemaChange(row.slug, oldColumns, data.columns);
  }
  let nextServiceId;
  if (data.service_id !== undefined) {
    if (data.service_id == null || data.service_id === "") {
      nextServiceId = null;
    } else {
      nextServiceId = await resolveNumericId(Service, data.service_id);
      if (!nextServiceId) {
        const err = new Error("Not found");
        err.status = 404;
        throw err;
      }
    }
  }
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.service_id !== undefined ? { service_id: nextServiceId } : {}),
    ...(data.columns ? { columns_json: data.columns } : {}),
    ...(data.layout_json !== undefined
      ? { layout_json: data.layout_json }
      : {}),
  });
  await audit(actor.id, "TABLE_SCHEMA_UPDATE", { schema_id: row.id }, { req });
  return withPublicId(row);
}

async function countTypesReferencingSchemaSlug(slug, { excludeTypeId } = {}) {
  const types = await RapportType.findAll({
    attributes: ["id", "schema_json"],
  });
  return types.filter((t) => {
    if (excludeTypeId != null && Number(t.id) === Number(excludeTypeId)) {
      return false;
    }
    return t.schema_json?.table_schema_slug === slug;
  }).length;
}

async function deleteTableSchema(id, actor, req, options = {}) {
  const row = await findByPublicId(RapportTableSchema, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (row.is_system) {
    const err = new Error("cannotDeleteSystemSchema");
    err.status = 409;
    throw err;
  }
  if (options.requireUnused) {
    const refCount = await countTypesReferencingSchemaSlug(row.slug);
    if (refCount > 0) {
      const err = new Error("tableSchemaInUse");
      err.status = 409;
      throw err;
    }
  }
  await row.destroy();
  await audit(actor.id, "TABLE_SCHEMA_DELETE", { schema_id: row.id }, { req });
}

async function detachDocumentTemplatesFromType(typeId) {
  const tid = Number(typeId);
  const templates = await RapportDocumentTemplate.findAll({
    where: {
      [Op.or]: [
        { rapport_type_id: tid },
        { rapport_type_ids: { [Op.contains]: [tid] } },
      ],
    },
  });
  for (const tpl of templates) {
    const ids = Array.isArray(tpl.rapport_type_ids)
      ? tpl.rapport_type_ids.map(Number).filter((id) => id !== tid)
      : [];
    const nextTypeId =
      tpl.rapport_type_id != null && Number(tpl.rapport_type_id) === tid
        ? null
        : tpl.rapport_type_id;
    await tpl.update({
      rapport_type_id: nextTypeId,
      rapport_type_ids: ids,
    });
  }
}

async function deleteRapportTypeIfUnused(id, actor, req) {
  const row = await findByPublicId(RapportType, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (row.content_kind === "fiche_lecture") {
    const err = new Error("cannotDeleteFicheLectureType");
    err.status = 409;
    throw err;
  }
  const rapportCount = await Rapport.count({
    where: { rapport_type_id: row.id },
  });
  if (rapportCount > 0) {
    const err = new Error("rapportTypeInUse");
    err.status = 409;
    throw err;
  }

  const schemaSlug = row.schema_json?.table_schema_slug || null;
  const serviceId = row.service_id;
  await detachDocumentTemplatesFromType(row.id);
  await row.destroy();
  await audit(
    actor.id,
    "RAPPORT_TYPE_DELETE",
    { rapport_type_id: Number(id), service_id: serviceId },
    { req },
  );

  if (schemaSlug) {
    const stillReferenced = await countTypesReferencingSchemaSlug(schemaSlug);
    if (stillReferenced === 0) {
      const schema = await RapportTableSchema.findOne({
        where: {
          slug: schemaSlug,
          service_id: serviceId,
          is_system: false,
        },
      });
      if (schema) {
        await schema.destroy();
        await audit(
          actor.id,
          "TABLE_SCHEMA_DELETE",
          { schema_id: schema.id, orphan_after_type: Number(id) },
          { req },
        );
      }
    }
  }

  return { ok: true };
}

async function rapportTypeIdsWithRapports(typeIds) {
  if (!typeIds.length) return new Set();
  const rows = await Rapport.findAll({
    attributes: ["rapport_type_id"],
    where: { rapport_type_id: { [Op.in]: typeIds } },
    raw: true,
  });
  return new Set(rows.map((r) => Number(r.rapport_type_id)));
}

async function listRapportTypes(serviceId) {
  const service = await loadServiceWithTypes(serviceId);
  const types = service.rapportTypes || [];
  const usedIds = await rapportTypeIdsWithRapports(
    types.map((t) => Number(t.id)),
  );
  const rapportTypes = types.map((t) => {
    const json = withPublicId(t);
    return {
      ...json,
      can_delete:
        json.content_kind !== "fiche_lecture" && !usedIds.has(Number(t.id)),
    };
  });
  return { service: withPublicId(service), rapportTypes };
}

async function createRapportType(serviceId, data, actor, req) {
  const service = await loadServiceWithTypes(serviceId);
  const numericServiceId = service.id;
  if (data.content_kind === "fiche_lecture") {
    const existing = await RapportType.findOne({
      where: { service_id: numericServiceId, content_kind: "fiche_lecture" },
    });
    if (existing) {
      const err = new Error("ficheLectureAlreadyExists");
      err.status = 409;
      throw err;
    }
    data.slug = data.slug || "fiche_lecture";
  }

  const schema_json = buildSchemaJsonForType(data.content_kind, data);
  const layoutKind =
    data.content_kind === "table_grid"
      ? "grid"
      : data.content_kind === "commune_list"
        ? "mixed"
        : "memo";

  let slug = data.slug?.trim();
  if (!slug) {
    const base = rapportTypeSlugFromNames(data.name_fr, data.name_ar);
    slug = await ensureUniqueSlug(
      base,
      async (s) =>
        RapportType.findOne({ where: { slug: s, service_id: numericServiceId } }),
      "_",
    );
  }

  const row = await RapportType.create({
    service_id: numericServiceId,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    layout_kind: layoutKind,
    content_kind: data.content_kind,
    versioning_mode:
      data.versioning_mode ||
      (data.content_kind === "table_grid" ? "versioned" : "standalone"),
    commune_content_kind: data.commune_content_kind || "complex",
    entity_target_kinds:
      data.content_kind === "commune_list"
        ? Array.isArray(data.entity_target_kinds) && data.entity_target_kinds.length
          ? data.entity_target_kinds
          : ["commune"]
        : ["commune"],
    schema_json,
  });
  await audit(
    actor.id,
    "RAPPORT_TYPE_CREATE",
    { rapport_type_id: row.id, service_id: numericServiceId },
    { req },
  );
  return withPublicId(row);
}

async function updateRapportType(id, data, actor, req) {
  const row = await findByPublicId(RapportType, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  let schema_json = row.schema_json;
  if (data.table_schema_slug || data.default_blocks || data.schema_json) {
    schema_json = buildSchemaJsonForType(
      data.content_kind || row.content_kind,
      {
        ...row.schema_json,
        ...data,
        commune_content_kind: data.commune_content_kind || row.commune_content_kind,
      },
    );
  }
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.versioning_mode ? { versioning_mode: data.versioning_mode } : {}),
    ...(data.commune_content_kind
      ? { commune_content_kind: data.commune_content_kind }
      : {}),
    ...(data.entity_target_kinds
      ? { entity_target_kinds: data.entity_target_kinds }
      : {}),
    ...(schema_json !== undefined ? { schema_json } : {}),
  });
  await audit(
    actor.id,
    "RAPPORT_TYPE_UPDATE",
    { rapport_type_id: row.id },
    { req },
  );
  return withPublicId(row);
}

async function hideRapportType(id, actor, req) {
  const row = await findByPublicId(RapportType, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (row.content_kind === "fiche_lecture") {
    const err = new Error("cannotHideFicheLectureType");
    err.status = 409;
    throw err;
  }
  if (row.hidden_at) {
    const err = new Error("Already hidden");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await row.update({ hidden_at: now });
  await audit(
    actor.id,
    "RAPPORT_TYPE_HIDE",
    { rapport_type_id: row.id, service_id: row.service_id },
    { req },
  );
  return withPublicId(row);
}

async function restoreRapportType(id, actor, req) {
  const row = await findByPublicId(RapportType, id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!row.hidden_at) {
    const err = new Error("Not hidden");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await row.update({ hidden_at: null });
  await audit(
    actor.id,
    "RAPPORT_TYPE_RESTORE",
    { rapport_type_id: row.id, service_id: row.service_id },
    { req },
  );
  return withPublicId(row);
}

module.exports = {
  listTableSchemas,
  createTableSchema,
  updateTableSchema,
  deleteTableSchema,
  deleteRapportTypeIfUnused,
  countTypesReferencingSchemaSlug,
  rapportTypeIdsWithRapports,
  listRapportTypes,
  createRapportType,
  updateRapportType,
  hideRapportType,
  restoreRapportType,
};
