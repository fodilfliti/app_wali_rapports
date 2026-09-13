const { Op } = require("sequelize");
const {
  Service,
  Department,
  RapportType,
  UserServiceGrant,
  User,
  Daira,
  Municipality,
  Direction,
  sequelize,
} = require("../../db");
const { audit } = require("../../services/audit");
const { baseSlugFromNames, ensureUniqueSlug } = require("../../utils/slugUtils");
const { listGrantsForService, replaceServiceGrants } = require("./serviceAccessService");
const { findByPublicId, withPublicId, publicId, resolveNumericId } = require("../access/idResolver");
const {
  isCreatorRole,
  roleFromCreatorKey,
} = require("../access/creatorRoles");
const {
  isOrgScope,
  roleForOrgScope,
  unitFkForOrgScope,
} = require("./serviceOrgScope");
const { buildFicheDefaultBlocks } = require("./documentDefaults");

const UNIT_MODEL = {
  daira: Daira,
  commune: Municipality,
  direction: Direction,
};

const UNIT_ASSOC = {
  daira: { model: Daira, as: "daira" },
  commune: { model: Municipality, as: "municipality" },
  direction: { model: Direction, as: "direction" },
};

async function listDepartments() {
  const rows = await Department.findAll({
    where: { is_active: true },
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
    attributes: ["id", "uuid", "name_ar", "name_fr", "sort_order"],
  });
  return rows.map((r) => withPublicId(r));
}

async function createDepartment(data, actor, req) {
  const duplicate = await Department.findOne({
    where: {
      is_active: true,
      [Op.or]: [{ name_ar: data.name_ar }, { name_fr: data.name_fr }],
    },
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
    is_active: true,
  });
  await audit(actor.id, "DEPARTMENT_CREATE", { department_id: row.id }, { req });
  return withPublicId(row);
}

async function updateDepartment(id, data, actor, req) {
  const row = await findByPublicId(Department, id);
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
          ...(data.name_fr ? [{ name_fr: data.name_fr }] : []),
        ],
      },
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
    ...(data.is_active != null ? { is_active: data.is_active } : {}),
  });
  await audit(actor.id, "DEPARTMENT_UPDATE", { department_id: row.id }, { req });
  return withPublicId(row);
}

async function deleteDepartment(id, actor, req) {
  const row = await findByPublicId(Department, id);
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

function serializeServiceAdmin(serviceRow, services, usersByService, childrenByParent) {
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

  const plain = withPublicId(serviceRow.toJSON ? serviceRow.toJSON() : serviceRow);
  const numericId = Number(serviceRow.id);
  plain.grant_count_direct = directGrantCount(numericId);
  plain.grant_count = serviceRow.is_folder ? folderGrantCount(numericId) : plain.grant_count_direct;
  plain.child_service_count = serviceRow.is_folder
    ? (childrenByParent.get(numericId) || []).length
    : 0;
  if (serviceRow.parent_service_id != null) {
    const parent = services.find((p) => Number(p.id) === Number(serviceRow.parent_service_id));
    if (parent) plain.parent_service_id = publicId(parent);
  }
  if (plain.department) plain.department = withPublicId(plain.department);
  if (plain.daira) {
    plain.daira = withPublicId(plain.daira);
    plain.daira_id = plain.daira.id;
  }
  if (plain.municipality) {
    plain.municipality = withPublicId(plain.municipality);
    plain.municipality_id = plain.municipality.id;
  }
  if (plain.direction) {
    plain.direction = withPublicId(plain.direction);
    plain.direction_id = plain.direction.id;
  }
  if (Array.isArray(plain.rapportTypes)) {
    plain.rapportTypes = plain.rapportTypes.map((t) => withPublicId(t));
  }
  if (plain.parent) plain.parent = withPublicId(plain.parent);
  return plain;
}

async function listServicesAdmin(query = {}) {
  const where = { is_active: true };
  const orgScope = query.org_scope ?? query.orgScope ?? null;
  if (orgScope) {
    if (!isOrgScope(orgScope)) {
      const err = new Error("Invalid org_scope");
      err.status = 400;
      throw err;
    }
    where.org_scope = String(orgScope);
  }

  for (const [scope, qKey, fk] of [
    ["daira", "daira_id", "daira_id"],
    ["commune", "municipality_id", "municipality_id"],
    ["direction", "direction_id", "direction_id"],
  ]) {
    const raw = query[qKey] ?? null;
    if (!raw) continue;
    const Model = UNIT_MODEL[scope];
    const nid = await resolveNumericId(Model, raw);
    if (!nid) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    where[fk] = nid;
    if (!where.org_scope) where.org_scope = scope;
  }

  const unitIncludes = Object.values(UNIT_ASSOC).map((spec) => ({
    ...spec,
    attributes: ["id", "uuid", "name_ar", "name_fr", "code"],
    required: false,
  }));

  const services = await Service.findAll({
    where,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
    include: [
      { model: Department, as: "department", attributes: ["id", "uuid", "name_ar", "name_fr"] },
      { model: RapportType, as: "rapportTypes", attributes: ["id", "uuid", "slug", "content_kind"] },
      {
        model: Service,
        as: "parent",
        attributes: ["id", "uuid", "slug", "name_ar", "name_fr", "org_scope"],
        required: false,
      },
      ...unitIncludes,
    ],
  });

  const allGrants = await UserServiceGrant.findAll({
    attributes: ["service_id", "user_id"],
    raw: true,
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

  return services.map((s) => serializeServiceAdmin(s, services, usersByService, childrenByParent));
}

async function resolveParentNumericId(parentPublicId, orgScope) {
  if (!parentPublicId) return null;
  const parent = await findByPublicId(Service, parentPublicId);
  if (!parent || !parent.is_folder) {
    const err = new Error("invalidParent");
    err.status = 400;
    throw err;
  }
  if (parent.org_scope && parent.org_scope !== orgScope) {
    const err = new Error("parentOrgScopeMismatch");
    err.status = 400;
    throw err;
  }
  return parent.id;
}

async function resolveDepartmentNumericId(departmentId) {
  if (departmentId == null || departmentId === "") return null;
  const nid = await resolveNumericId(Department, departmentId);
  if (!nid) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return nid;
}

async function nextUniqueSlug(base, suffixHint, transaction = null) {
  const withHint = suffixHint
    ? `${base.slice(0, Math.max(1, 80 - suffixHint.length - 2))}--${suffixHint}`.slice(0, 80)
    : base.slice(0, 80);
  return ensureUniqueSlug(withHint, async (s) =>
    Service.findOne({ where: { slug: s }, ...(transaction ? { transaction } : {}) })
  );
}

async function createFicheTypeTx(serviceId, transaction, letterheadCtx = {}) {
  await RapportType.create(
    {
      service_id: serviceId,
      slug: "fiche_lecture",
      name_ar: "مذكرة استخلاصية",
      name_fr: "Fiche lecture",
      layout_kind: "memo",
      content_kind: "fiche_lecture",
      versioning_mode: "standalone",
      schema_json: { default_blocks: buildFicheDefaultBlocks(letterheadCtx) },
    },
    { transaction }
  );
}

async function resolveOrgUnitNumericIds(orgScope, data) {
  const Model = UNIT_MODEL[orgScope];
  if (!Model) return [];

  const wantAll = data.org_units_all === true;
  const ids = Array.isArray(data.org_unit_ids) ? data.org_unit_ids : [];

  if (!wantAll && ids.length === 0 && data.org_units_all === false) {
    const err = new Error("orgUnitsRequired");
    err.status = 400;
    throw err;
  }

  if (wantAll || ids.length === 0) {
    const rows = await Model.findAll({
      where: { hidden_at: null },
      attributes: ["id", "uuid", "name_ar", "name_fr"],
      order: [["id", "ASC"]],
    });
    if (!rows.length) {
      const err = new Error("noOrgUnits");
      err.status = 400;
      throw err;
    }
    return rows.map((r) => ({
      numericId: r.id,
      publicId: publicId(r),
      name_ar: r.name_ar,
      name_fr: r.name_fr,
    }));
  }

  const out = [];
  for (const uid of ids) {
    const row = await findByPublicId(Model, uid);
    if (!row || row.hidden_at) {
      const err = new Error("orgUnitNotFound");
      err.status = 400;
      throw err;
    }
    out.push({
      numericId: row.id,
      publicId: publicId(row),
      name_ar: row.name_ar,
      name_fr: row.name_fr,
    });
  }
  return out;
}

async function createService(data, actor, req) {
  const orgScope = data.org_scope || "diwan";
  if (!isOrgScope(orgScope)) {
    const err = new Error("Invalid org_scope");
    err.status = 400;
    throw err;
  }

  const isFolder = data.is_folder === true;
  const parentNumericId = await resolveParentNumericId(data.parent_service_id, orgScope);
  const departmentNumericId = await resolveDepartmentNumericId(data.department_id);
  const base = data.slug?.trim()
    ? data.slug.trim()
    : baseSlugFromNames(data.name_fr, data.name_ar, "service");

  if (isFolder || orgScope === "diwan") {
    if (data.slug?.trim()) {
      const existing = await Service.findOne({ where: { slug: data.slug.trim() } });
      if (existing) {
        const err = new Error("slugExists");
        err.status = 409;
        throw err;
      }
    }
    const slug = data.slug?.trim() ? data.slug.trim() : await nextUniqueSlug(base, null);

    const service = await sequelize.transaction(async (transaction) => {
      const row = await Service.create(
        {
          department_id: departmentNumericId,
          slug,
          name_ar: data.name_ar,
          name_fr: data.name_fr,
          sort_order: data.sort_order ?? 0,
          is_active: true,
          is_folder: isFolder,
          parent_service_id: parentNumericId,
          org_scope: orgScope,
          daira_id: null,
          municipality_id: null,
          direction_id: null,
        },
        { transaction }
      );
      if (!row.is_folder) {
        await createFicheTypeTx(row.id, transaction, { orgScope });
      }
      return row;
    });

    await audit(
      actor.id,
      "SERVICE_CREATE",
      { service_id: service.id, slug: service.slug, org_scope: orgScope },
      { req }
    );
    return { service: withPublicId(service), services: [withPublicId(service)], count: 1 };
  }

  const units = await resolveOrgUnitNumericIds(orgScope, data);
  const fk = unitFkForOrgScope(orgScope);
  const created = await sequelize.transaction(async (transaction) => {
    const rows = [];
    for (const unit of units) {
      const slug = await nextUniqueSlug(
        base,
        `${orgScope}-${String(unit.publicId).slice(0, 8)}`,
        transaction
      );
      const payload = {
        department_id: departmentNumericId,
        slug,
        name_ar: data.name_ar,
        name_fr: data.name_fr,
        sort_order: data.sort_order ?? 0,
        is_active: true,
        is_folder: false,
        parent_service_id: parentNumericId,
        org_scope: orgScope,
        daira_id: null,
        municipality_id: null,
        direction_id: null,
      };
      payload[fk] = unit.numericId;
      const row = await Service.create(payload, { transaction });
      await createFicheTypeTx(row.id, transaction, {
        orgScope,
        unitNameAr: unit.name_ar,
        unitNameFr: unit.name_fr,
      });
      rows.push(row);
    }
    return rows;
  });

  await audit(
    actor.id,
    "SERVICE_CREATE_BULK",
    { count: created.length, org_scope: orgScope, name_ar: data.name_ar },
    { req }
  );

  const services = created.map((s) => withPublicId(s));
  return { service: services[0] || null, services, count: services.length };
}

async function updateService(id, data, actor, req) {
  const service = await findByPublicId(Service, id);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  let departmentNumericId;
  if (data.department_id !== undefined) {
    if (data.department_id == null || data.department_id === "") {
      departmentNumericId = null;
    } else {
      departmentNumericId = await resolveNumericId(Department, data.department_id);
      if (!departmentNumericId) {
        const err = new Error("Not found");
        err.status = 404;
        throw err;
      }
    }
  }

  await service.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.sort_order != null ? { sort_order: data.sort_order } : {}),
    ...(data.is_active != null ? { is_active: data.is_active } : {}),
    ...(data.department_id !== undefined ? { department_id: departmentNumericId } : {}),
  });

  await audit(actor.id, "SERVICE_UPDATE", { service_id: service.id }, { req });
  return withPublicId(service);
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
  const service = await findByPublicId(Service, id);
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

async function resolveGrantPickerContext(query = {}) {
  if (query.service_id || query.serviceId) {
    const service = await findByPublicId(Service, query.service_id || query.serviceId);
    if (!service) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    const orgScope = service.org_scope || "diwan";
    return {
      orgScope,
      daira_id: service.daira_id != null ? Number(service.daira_id) : null,
      municipality_id: service.municipality_id != null ? Number(service.municipality_id) : null,
      direction_id: service.direction_id != null ? Number(service.direction_id) : null,
    };
  }

  const raw = query.org_scope ?? query.orgScope ?? null;
  let orgScope = null;
  if (raw) {
    if (!isOrgScope(raw)) {
      const err = new Error("Invalid org_scope");
      err.status = 400;
      throw err;
    }
    orgScope = String(raw);
  }

  const ctx = {
    orgScope,
    daira_id: null,
    municipality_id: null,
    direction_id: null,
  };

  for (const [scope, qKey, fk] of [
    ["daira", "daira_id", "daira_id"],
    ["commune", "municipality_id", "municipality_id"],
    ["direction", "direction_id", "direction_id"],
  ]) {
    const unitRaw = query[qKey] ?? null;
    if (!unitRaw) continue;
    const Model = UNIT_MODEL[scope];
    const nid = await resolveNumericId(Model, unitRaw);
    if (!nid) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    ctx[fk] = nid;
    if (!ctx.orgScope) ctx.orgScope = scope;
  }

  return ctx;
}

async function listOfficeUsersForGrantPicker(query = {}) {
  const ctx = await resolveGrantPickerContext(query);
  let orgScope = ctx.orgScope;
  let roleWhere;

  if (orgScope) {
    const role = roleForOrgScope(orgScope);
    if (!role) {
      const err = new Error("Invalid org_scope");
      err.status = 400;
      throw err;
    }
    roleWhere = role;
  } else {
    const rawKey = query.creator_key ?? query.creatorKey ?? null;
    const rawRole = query.role ?? null;
    if (rawKey) {
      const role = roleFromCreatorKey(String(rawKey));
      if (!role) {
        const err = new Error("Invalid creator_key");
        err.status = 400;
        throw err;
      }
      roleWhere = role;
    } else if (rawRole) {
      const fromKey = roleFromCreatorKey(String(rawRole));
      const role = fromKey || String(rawRole);
      if (!isCreatorRole(role)) {
        const err = new Error("Invalid role");
        err.status = 400;
        throw err;
      }
      roleWhere = role;
    } else {
      const err = new Error("org_scopeRequired");
      err.status = 400;
      throw err;
    }
  }

  const where = { role: roleWhere, is_blocked: false, deleted_at: null };
  // Non-diwan: only users bound to this exact daira / commune / direction
  if (orgScope === "daira" && ctx.daira_id != null) where.daira_id = ctx.daira_id;
  if (orgScope === "commune" && ctx.municipality_id != null) where.municipality_id = ctx.municipality_id;
  if (orgScope === "direction" && ctx.direction_id != null) where.direction_id = ctx.direction_id;

  const users = await User.findAll({
    where,
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
    attributes: [
      "id",
      "uuid",
      "username",
      "name",
      "job_title",
      "role",
      "department_id",
      "daira_id",
      "municipality_id",
      "direction_id",
    ],
    include: [
      { model: Department, as: "department", attributes: ["id", "uuid", "name_ar", "name_fr"] },
      { model: Daira, as: "daira", attributes: ["id", "uuid", "name_ar", "name_fr"], required: false },
      {
        model: Municipality,
        as: "municipality",
        attributes: ["id", "uuid", "name_ar", "name_fr"],
        required: false,
      },
      {
        model: Direction,
        as: "direction",
        attributes: ["id", "uuid", "name_ar", "name_fr"],
        required: false,
      },
    ],
  });
  return users.map((u) => {
    const plain = withPublicId(u);
    if (plain.department) plain.department = withPublicId(plain.department);
    if (plain.daira) plain.daira = withPublicId(plain.daira);
    if (plain.municipality) plain.municipality = withPublicId(plain.municipality);
    if (plain.direction) plain.direction = withPublicId(plain.direction);
    return plain;
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
  listOfficeUsersForGrantPicker,
};
