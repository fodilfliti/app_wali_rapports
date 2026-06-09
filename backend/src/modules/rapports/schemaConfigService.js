const { Op } = require("sequelize");
const { Service, RapportType, RapportTableSchema } = require("../../db");
const { audit } = require("../../services/audit");
const { baseSlugFromNames, ensureUniqueSlug, rapportTypeSlugFromNames } = require("../../utils/slugUtils");
const { remapDraftRapportsForSchemaChange } = require("./schemaRowRemapService");
const { hasBilingualText } = require("../../validation/bilingual");

const COLUMN_TYPES = new Set(["text", "number", "date", "choice", "commune_ref", "formula"]);

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
  if (contentKind === "table_grid" || contentKind === "commune_list") {
    const slug = body.table_schema_slug || body.schema_json?.table_schema_slug;
    if (!slug) {
      const err = new Error("tableSchemaSlugRequired");
      err.status = 400;
      throw err;
    }
    return {
      table_schema_slug: slug,
      table_key: body.table_key || body.schema_json?.table_key || "main"
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
    const serviceId = Number(query.service_id);
    const includeShared = query.include_shared === "1" || query.include_shared === "true";
    if (includeShared) {
      where[Op.or] = [{ service_id: serviceId }, { service_id: null }];
    } else {
      const types = await RapportType.findAll({
        where: { service_id: serviceId, content_kind: "table_grid" },
        attributes: ["schema_json"]
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
        { name_fr: { [Op.iLike]: `%${query.q}%` } }
      ]
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
    include: [{ model: Service, as: "service", attributes: ["id", "slug", "name_ar", "name_fr"], required: false }]
  });

  return {
    schemas: rows,
    total: count,
    page,
    totalPages: Math.max(1, Math.ceil(count / limit))
  };
}

async function createTableSchema(data, actor, req) {
  validateColumns(data.columns);
  let slug = data.slug?.trim();
  if (!slug) {
    const base = baseSlugFromNames(data.name_fr, data.name_ar, "schema");
    slug = await ensureUniqueSlug(base, async (s) => RapportTableSchema.findOne({ where: { slug: s } }));
  }
  const row = await RapportTableSchema.create({
    service_id: data.service_id || null,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    columns_json: data.columns,
    layout_json: data.layout_json ?? null,
    is_system: false
  });
  await audit(actor.id, "TABLE_SCHEMA_CREATE", { schema_id: row.id, slug: row.slug }, { req });
  return row;
}

async function updateTableSchema(id, data, actor, req) {
  const row = await RapportTableSchema.findByPk(id);
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
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.service_id !== undefined ? { service_id: data.service_id } : {}),
    ...(data.columns ? { columns_json: data.columns } : {}),
    ...(data.layout_json !== undefined ? { layout_json: data.layout_json } : {})
  });
  await audit(actor.id, "TABLE_SCHEMA_UPDATE", { schema_id: row.id }, { req });
  return row;
}

async function deleteTableSchema(id, actor, req) {
  const row = await RapportTableSchema.findByPk(id);
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
  await row.destroy();
  await audit(actor.id, "TABLE_SCHEMA_DELETE", { schema_id: id }, { req });
}

async function listRapportTypes(serviceId) {
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return { service, rapportTypes: service.rapportTypes || [] };
}

async function createRapportType(serviceId, data, actor, req) {
  const service = await Service.findByPk(serviceId);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (data.content_kind === "fiche_lecture") {
    const existing = await RapportType.findOne({
      where: { service_id: serviceId, content_kind: "fiche_lecture" }
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
    data.content_kind === "table_grid" ? "grid" : data.content_kind === "commune_list" ? "mixed" : "memo";

  let slug = data.slug?.trim();
  if (!slug) {
    const base = rapportTypeSlugFromNames(data.name_fr, data.name_ar);
    slug = await ensureUniqueSlug(
      base,
      async (s) => RapportType.findOne({ where: { slug: s, service_id: serviceId } }),
      "_"
    );
  }

  const row = await RapportType.create({
    service_id: serviceId,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    layout_kind: layoutKind,
    content_kind: data.content_kind,
    versioning_mode: data.versioning_mode || (data.content_kind === "table_grid" ? "versioned" : "standalone"),
    schema_json
  });
  await audit(actor.id, "RAPPORT_TYPE_CREATE", { rapport_type_id: row.id, service_id: serviceId }, { req });
  return row;
}

async function updateRapportType(id, data, actor, req) {
  const row = await RapportType.findByPk(id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  let schema_json = row.schema_json;
  if (data.table_schema_slug || data.default_blocks || data.schema_json) {
    schema_json = buildSchemaJsonForType(data.content_kind || row.content_kind, {
      ...row.schema_json,
      ...data
    });
  }
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.versioning_mode ? { versioning_mode: data.versioning_mode } : {}),
    ...(schema_json !== undefined ? { schema_json } : {})
  });
  await audit(actor.id, "RAPPORT_TYPE_UPDATE", { rapport_type_id: row.id }, { req });
  return row;
}

module.exports = {
  listTableSchemas,
  createTableSchema,
  updateTableSchema,
  deleteTableSchema,
  listRapportTypes,
  createRapportType,
  updateRapportType
};
