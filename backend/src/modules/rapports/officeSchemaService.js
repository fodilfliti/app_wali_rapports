const { Op } = require("sequelize");
const { RapportTableSchema } = require("../../db");
const { assertServiceAccess } = require("./serviceAccessService");
const schemaConfig = require("./schemaConfigService");
const { audit } = require("../../services/audit");
const { baseSlugFromNames, ensureUniqueSlug } = require("../../utils/slugUtils");

async function listSchemasForOfficeService(serviceId, user) {
  await assertServiceAccess(user, serviceId, "manage");
  const owned = await RapportTableSchema.findAll({
    where: { service_id: serviceId },
    order: [["slug", "ASC"]],
  });
  const templates = await RapportTableSchema.findAll({
    where: {
      [Op.or]: [{ service_id: null }, { is_system: true }],
    },
    order: [["slug", "ASC"]],
  });

  const { RapportType } = require("../../db");
  const types = await RapportType.findAll({
    attributes: ["schema_json"],
    raw: true,
  });
  const usedSlugs = new Set(
    types.map((t) => t.schema_json?.table_schema_slug).filter(Boolean),
  );

  const schemas = owned.map((row) => {
    const json = row.toJSON ? row.toJSON() : { ...row };
    return {
      ...json,
      can_delete: !row.is_system && !usedSlugs.has(row.slug),
    };
  });
  const templateRows = templates.map((row) => {
    const json = row.toJSON ? row.toJSON() : { ...row };
    return { ...json, can_delete: false };
  });

  return { schemas, templates: templateRows };
}

async function createSchemaForOfficeService(serviceId, data, user, req) {
  await assertServiceAccess(user, serviceId, "manage");
  const row = await schemaConfig.createTableSchema(
    {
      ...data,
      service_id: serviceId,
      columns: data.columns
    },
    user,
    req
  );
  if (data.layout_json != null) {
    await row.update({ layout_json: data.layout_json });
  }
  return row;
}

async function updateSchemaForOffice(schemaId, data, user, req) {
  const row = await RapportTableSchema.findByPk(schemaId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (row.is_system) {
    const err = new Error("cannotEditSystemSchema");
    err.status = 409;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  return schemaConfig.updateTableSchema(schemaId, data, user, req);
}

async function duplicateSchemaToService(serviceId, sourceSchemaId, newSlug, user, req) {
  await assertServiceAccess(user, serviceId, "manage");
  const source = await RapportTableSchema.findByPk(sourceSchemaId);
  if (!source) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  let slug = newSlug?.trim();
  if (!slug) {
    const base = `${baseSlugFromNames(source.name_fr, source.name_ar, "schema")}-copy`;
    slug = await ensureUniqueSlug(base, async (s) => RapportTableSchema.findOne({ where: { slug: s } }));
  } else {
    const existing = await RapportTableSchema.findOne({ where: { slug } });
    if (existing) {
      const err = new Error("slugAlreadyExists");
      err.status = 409;
      throw err;
    }
  }
  const row = await RapportTableSchema.create({
    service_id: serviceId,
    slug,
    name_ar: source.name_ar,
    name_fr: source.name_fr,
    columns_json: source.columns_json,
    layout_json: source.layout_json,
    is_system: false
  });
  await audit(user.id, "TABLE_SCHEMA_DUPLICATE", { schema_id: row.id, source_id: source.id }, { req });
  return row;
}

async function listRapportTypesForOffice(serviceId, user) {
  await assertServiceAccess(user, serviceId, "manage");
  return schemaConfig.listRapportTypes(serviceId);
}

async function createRapportTypeForOffice(serviceId, data, user, req) {
  await assertServiceAccess(user, serviceId, "manage");
  return schemaConfig.createRapportType(serviceId, data, user, req);
}

async function updateRapportTypeForOffice(rapportTypeId, data, user, req) {
  const { RapportType } = require("../../db");
  const row = await RapportType.findByPk(rapportTypeId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  return schemaConfig.updateRapportType(rapportTypeId, data, user, req);
}

async function hideRapportTypeForOffice(rapportTypeId, user, req) {
  const { RapportType } = require("../../db");
  const row = await RapportType.findByPk(rapportTypeId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  return schemaConfig.hideRapportType(rapportTypeId, user, req);
}

async function restoreRapportTypeForOffice(rapportTypeId, user, req) {
  const { RapportType } = require("../../db");
  const row = await RapportType.findByPk(rapportTypeId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  return schemaConfig.restoreRapportType(rapportTypeId, user, req);
}

async function deleteRapportTypeForOffice(rapportTypeId, user, req) {
  const { RapportType } = require("../../db");
  const row = await RapportType.findByPk(rapportTypeId);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  return schemaConfig.deleteRapportTypeIfUnused(rapportTypeId, user, req);
}

async function deleteSchemaForOffice(schemaId, user, req) {
  const row = await RapportTableSchema.findByPk(schemaId);
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
  if (!row.service_id) {
    const err = new Error("cannotDeleteSharedSchema");
    err.status = 409;
    throw err;
  }
  await assertServiceAccess(user, row.service_id, "manage");
  await schemaConfig.deleteTableSchema(schemaId, user, req, {
    requireUnused: true,
  });
  return { ok: true };
}

module.exports = {
  listSchemasForOfficeService,
  createSchemaForOfficeService,
  updateSchemaForOffice,
  deleteSchemaForOffice,
  duplicateSchemaToService,
  listRapportTypesForOffice,
  createRapportTypeForOffice,
  updateRapportTypeForOffice,
  hideRapportTypeForOffice,
  restoreRapportTypeForOffice,
  deleteRapportTypeForOffice,
};
