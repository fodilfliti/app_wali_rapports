const { Op } = require("sequelize");
const { Service, Department, RapportType, UserServiceGrant, User } = require("../../db");
const { audit } = require("../../services/audit");const { baseSlugFromNames, ensureUniqueSlug } = require("../../utils/slugUtils");
const { listGrantsForService, replaceServiceGrants } = require("./serviceAccessService");

const { buildFicheDefaultBlocks } = require("./documentDefaults");

async function listDepartments() {
  return Department.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
    attributes: ["id", "name_ar", "name_fr", "sort_order"]
  });
}

async function createDepartment(data, actor, req) {
  const duplicate = await Department.findOne({
    where: {
      is_active: true,
      [Op.or]: [{ name_ar: data.name_ar }, { name_fr: data.name_fr }]
    }
  });
  if (duplicate) {
    const err = new Error("departmentNameExists");
    err.status = 409;
    throw err;
  }

  const maxSort = (await Department.max("sort_order")) || 0;
  const row = await Department.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    sort_order: data.sort_order ?? Number(maxSort) + 1,
    is_active: true
  });
  await audit(actor.id, "DEPARTMENT_CREATE", { department_id: row.id }, { req });
  return row;
}

async function updateDepartment(id, data, actor, req) {
  const row = await Department.findByPk(id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  if (data.name_ar || data.name_fr) {
    const duplicate = await Department.findOne({
      where: {
        id: { [Op.ne]: row.id },
        is_active: true,
        [Op.or]: [
          ...(data.name_ar ? [{ name_ar: data.name_ar }] : []),
          ...(data.name_fr ? [{ name_fr: data.name_fr }] : [])
        ]
      }
    });
    if (duplicate) {
      const err = new Error("departmentNameExists");
      err.status = 409;
      throw err;
    }
  }

  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.sort_order != null ? { sort_order: data.sort_order } : {}),
    ...(data.is_active != null ? { is_active: data.is_active } : {})
  });
  await audit(actor.id, "DEPARTMENT_UPDATE", { department_id: row.id }, { req });
  return row;
}

async function deleteDepartment(id, actor, req) {
  const row = await Department.findByPk(id);
  if (!row) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!row.is_active) {
    const err = new Error("Already deleted");
    err.status = 409;
    throw err;
  }
  await Service.update({ department_id: null }, { where: { department_id: row.id } });
  await row.update({ is_active: false });
  await audit(actor.id, "DEPARTMENT_DELETE", { department_id: row.id }, { req });
  return { ok: true };
}

async function listServicesAdmin() {
  const services = await Service.findAll({    where: { is_active: true },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] },
      { model: RapportType, as: "rapportTypes", attributes: ["id", "slug", "content_kind"] },
      { model: Service, as: "parent", attributes: ["id", "slug", "name_ar", "name_fr"], required: false }
    ]
  });

  const allGrants = await UserServiceGrant.findAll({
    attributes: ["service_id", "user_id"],
    raw: true
  });
  const usersByService = new Map();
  for (const grant of allGrants) {
    const serviceId = Number(grant.service_id);
    if (!usersByService.has(serviceId)) usersByService.set(serviceId, new Set());
    usersByService.get(serviceId).add(Number(grant.user_id));
  }

  const childrenByParent = new Map();
  for (const service of services) {
    if (!service.parent_service_id) continue;
    const parentId = Number(service.parent_service_id);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(service);
  }

  function directGrantCount(serviceId) {
    return usersByService.get(Number(serviceId))?.size || 0;
  }

  function descendantLeafIds(serviceId) {
    const node = services.find((s) => Number(s.id) === Number(serviceId));
    if (!node) return [];
    if (!node.is_folder) return [Number(node.id)];
    const children = childrenByParent.get(Number(serviceId)) || [];
    return children.flatMap((child) => descendantLeafIds(child.id));
  }

  function folderGrantCount(folderId) {
    const users = new Set();
    for (const leafId of descendantLeafIds(folderId)) {
      for (const userId of usersByService.get(leafId) || []) users.add(userId);
    }
    return users.size;
  }

  return services.map((s) => {
    const plain = s.toJSON();
    plain.grant_count_direct = directGrantCount(s.id);
    plain.grant_count = s.is_folder ? folderGrantCount(s.id) : plain.grant_count_direct;
    plain.child_service_count = s.is_folder ? (childrenByParent.get(Number(s.id)) || []).length : 0;
    return plain;
  });
}

async function createService(data, actor, req) {
  let slug = data.slug?.trim();
  if (!slug) {
    const base = baseSlugFromNames(data.name_fr, data.name_ar, "service");
    slug = await ensureUniqueSlug(base, async (s) => Service.findOne({ where: { slug: s } }));
  } else {
    const existing = await Service.findOne({ where: { slug } });
    if (existing) {
      const err = new Error("slugExists");
      err.status = 409;
      throw err;
    }
  }

  if (data.parent_service_id) {
    const parent = await Service.findByPk(data.parent_service_id);
    if (!parent || !parent.is_folder) {
      const err = new Error("invalidParent");
      err.status = 400;
      throw err;
    }
  }

  const service = await Service.create({
    department_id: data.department_id ?? null,
    slug,
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    sort_order: data.sort_order ?? 0,
    is_active: true,
    is_folder: data.is_folder ?? false,
    parent_service_id: data.parent_service_id || null
  });

  if (!service.is_folder) {
    await RapportType.create({
      service_id: service.id,
      slug: "fiche_lecture",
      name_ar: "مذكرة استخلاصية",
      name_fr: "Fiche lecture",
      layout_kind: "memo",
      content_kind: "fiche_lecture",
      versioning_mode: "standalone",
      schema_json: { default_blocks: buildFicheDefaultBlocks() }
    });
  }

  await audit(actor.id, "SERVICE_CREATE", { service_id: service.id, slug: service.slug }, { req });
  return service;
}

async function updateService(id, data, actor, req) {
  const service = await Service.findByPk(id);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  await service.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.sort_order != null ? { sort_order: data.sort_order } : {}),
    ...(data.is_active != null ? { is_active: data.is_active } : {}),
    ...(data.department_id !== undefined ? { department_id: data.department_id } : {}),
  });

  await audit(actor.id, "SERVICE_UPDATE", { service_id: service.id }, { req });
  return service;
}

async function collectActiveServiceSubtreeIds(rootId) {
  const ids = [Number(rootId)];
  const queue = [Number(rootId)];
  while (queue.length) {
    const id = queue.shift();
    const children = await Service.findAll({
      where: { parent_service_id: id, is_active: true },
      attributes: ["id"],
    });
    for (const child of children) {
      const cid = Number(child.id);
      ids.push(cid);
      queue.push(cid);
    }
  }
  return ids;
}

async function deleteService(id, actor, req) {
  const service = await Service.findByPk(id);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!service.is_active) {
    const err = new Error("Already deleted");
    err.status = 409;
    throw err;
  }
  const ids = await collectActiveServiceSubtreeIds(service.id);
  await Service.update({ is_active: false }, { where: { id: ids } });
  await audit(actor.id, "SERVICE_DELETE", { service_id: service.id, count: ids.length }, { req });
  return { ok: true };
}

async function listOfficeUsersForGrantPicker() {
  return User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "username", "name", "job_title", "department_id"],
    include: [{ model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }]
  });
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listServicesAdmin,
  createService,
  updateService,
  deleteService,
  listGrantsForService,
  replaceServiceGrants,
  listOfficeUsersForGrantPicker
};