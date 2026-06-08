const { UserServiceGrant, Rapport, Service } = require("../../db");

const LEVEL_RANK = { none: 0, view: 1, manage: 2 };

function rank(level) {
  return LEVEL_RANK[level] ?? 0;
}

async function getAccessMapForUser(userId) {
  const grants = await UserServiceGrant.findAll({ where: { user_id: userId } });
  return Object.fromEntries(grants.map((g) => [Number(g.service_id), g.access_level]));
}

async function resolveAccessLevel(user, serviceId) {
  if (!user || !serviceId) return "none";
  if (user.role === "ADMIN") return "manage";
  const grant = await UserServiceGrant.findOne({
    where: { user_id: user.id, service_id: serviceId }
  });
  return grant?.access_level || "none";
}

async function assertServiceAccess(user, serviceId, minLevel = "view") {
  const level = await resolveAccessLevel(user, serviceId);
  if (rank(level) < rank(minLevel)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return level;
}

async function assertRapportAccess(user, rapportId, minLevel = "view") {
  const rapport = await Rapport.findByPk(rapportId, { attributes: ["id", "service_id"] });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const level = await assertServiceAccess(user, rapport.service_id, minLevel);
  return { rapport, accessLevel: level };
}

function filterServiceTree(services, accessMap) {
  const result = [];
  for (const s of services) {
    const node = s.toJSON ? s.toJSON() : { ...s };
    const selfLevel = accessMap[node.id];
    let children = [];
    if (node.children?.length) {
      children = filterServiceTree(node.children, accessMap);
    }
    if (selfLevel) {
      result.push({ ...node, access_level: selfLevel, children: node.is_folder ? children : undefined });
    } else if (node.is_folder && children.length) {
      result.push({ ...node, access_level: "view", children });
    }
  }
  return result;
}

async function listGrantsForService(serviceId) {
  const { User, Department } = require("../../db");
  const grants = await UserServiceGrant.findAll({
    where: { service_id: serviceId },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "username", "name", "job_title", "department_id", "is_blocked"],
        include: [{ model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }]
      }
    ],
    order: [["id", "ASC"]]
  });
  return grants;
}

async function replaceServiceGrants(serviceId, grantRows, actor, req) {
  const { User } = require("../../db");
  const { audit } = require("../../services/audit");

  const service = await Service.findByPk(serviceId);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const normalized = [];
  for (const row of grantRows || []) {
    const user = await User.findByPk(row.user_id);
    if (!user || user.role !== "OFFICE_USER" || user.is_blocked) continue;
    if (!["view", "manage"].includes(row.access_level)) continue;
    normalized.push({
      user_id: user.id,
      service_id: serviceId,
      access_level: row.access_level
    });
  }

  await UserServiceGrant.destroy({ where: { service_id: serviceId } });
  if (normalized.length) {
    await UserServiceGrant.bulkCreate(normalized);
  }
  await audit(actor.id, "SERVICE_GRANTS_UPDATE", { service_id: serviceId, count: normalized.length }, { req });
  return listGrantsForService(serviceId);
}

module.exports = {
  getAccessMapForUser,
  resolveAccessLevel,
  assertServiceAccess,
  assertRapportAccess,
  filterServiceTree,
  listGrantsForService,
  replaceServiceGrants
};
