const { Op } = require("sequelize");
const { UserServiceGrant, Rapport, Service, User } = require("../../db");
const { findByPublicId, resolveNumericId, withPublicId } = require("../access/idResolver");

const LEVEL_RANK = { none: 0, view: 1, manage: 2 };

function rank(level) {
  return LEVEL_RANK[level] ?? 0;
}

async function resolveNumericServiceId(serviceId) {
  return resolveNumericId(Service, serviceId);
}

async function getAccessMapForUser(userId) {
  const numericUserId = await resolveNumericId(User, userId);
  if (!numericUserId) return {};
  const grants = await UserServiceGrant.findAll({ where: { user_id: numericUserId } });
  return Object.fromEntries(grants.map((g) => [Number(g.service_id), g.access_level]));
}

/** Granted leaf service ids for an office user (empty if none). */
async function getAccessibleServiceIds(userId) {
  const accessMap = await getAccessMapForUser(userId);
  return Object.keys(accessMap).map(Number).filter(Boolean);
}

/**
 * Sequelize where fragment: rapports in services granted to officeUserId.
 * Returns { service_id: { [Op.in]: [] } } when the user has no grants (matches nothing).
 */
async function officeUserServiceScopeWhere(officeUserId) {
  const grantedIds = await getAccessibleServiceIds(officeUserId);
  return { service_id: { [Op.in]: grantedIds } };
}

/**
 * Active, non-blocked OFFICE_USER ids with a grant on serviceId.
 * @param {number} serviceId
 * @param {{ minLevel?: 'view'|'manage' }} [opts]
 */
async function getOfficeUserIdsWithServiceAccess(serviceId, opts = {}) {
  const minLevel = opts.minLevel || "view";
  const numericServiceId = await resolveNumericServiceId(serviceId);
  if (!numericServiceId) return [];
  const grants = await UserServiceGrant.findAll({
    where: { service_id: numericServiceId },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "role", "is_blocked", "deleted_at"],
        required: true,
      },
    ],
  });
  const ids = [];
  for (const g of grants) {
    const u = g.user;
    if (!u || u.role !== "OFFICE_USER" || u.is_blocked || u.deleted_at) continue;
    if (rank(g.access_level) < rank(minLevel)) continue;
    ids.push(Number(u.id));
  }
  return ids;
}

/**
 * Office recipients for feedback on a rapport: all grant holders, else owner/creator fallback.
 */
async function resolveOfficeFeedbackRecipientIds(rapport) {
  const serviceId = rapport?.service_id != null ? Number(rapport.service_id) : null;
  if (serviceId) {
    const grantees = await getOfficeUserIdsWithServiceAccess(serviceId, {
      minLevel: "view",
    });
    if (grantees.length) return grantees;
  }
  const fallback = [rapport?.owner_office_user_id, rapport?.created_by_user_id]
    .map((x) => (x != null ? Number(x) : null))
    .filter(Boolean);
  if (!fallback.length) return [];
  const users = await User.findAll({
    where: { id: fallback, role: "OFFICE_USER", is_blocked: false, deleted_at: null },
    attributes: ["id"],
  });
  return users.map((u) => Number(u.id));
}

async function resolveAccessLevel(user, serviceId) {
  if (!user || !serviceId) return "none";
  if (user.role === "ADMIN") return "manage";
  const numericServiceId = await resolveNumericServiceId(serviceId);
  if (!numericServiceId) return "none";
  const grant = await UserServiceGrant.findOne({
    where: { user_id: user.id, service_id: numericServiceId }
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
  const rapport = await findByPublicId(Rapport, rapportId, { attributes: ["id", "uuid", "service_id"] });
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
  const numericServiceId = await resolveNumericServiceId(serviceId);
  if (!numericServiceId) return [];
  const grants = await UserServiceGrant.findAll({
    where: { service_id: numericServiceId },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "uuid", "username", "name", "job_title", "department_id", "is_blocked"],
        include: [{ model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }]
      }
    ],
    order: [["id", "ASC"]]
  });
  return grants.map((g) => {
    const plain = g.toJSON ? g.toJSON() : g;
    if (plain.user) plain.user = withPublicId(plain.user);
    if (plain.user?.id != null) plain.user_id = plain.user.id;
    return plain;
  });
}

async function replaceServiceGrants(serviceId, grantRows, actor, req) {
  const { User } = require("../../db");
  const { audit } = require("../../services/audit");

  const service = await findByPublicId(Service, serviceId);
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const numericServiceId = service.id;

  const normalized = [];
  for (const row of grantRows || []) {
    const user = await findByPublicId(User, row.user_id);
    if (!user || user.role !== "OFFICE_USER" || user.is_blocked || user.deleted_at) continue;
    if (!["view", "manage"].includes(row.access_level)) continue;
    normalized.push({
      user_id: user.id,
      service_id: numericServiceId,
      access_level: row.access_level
    });
  }

  await UserServiceGrant.destroy({ where: { service_id: numericServiceId } });
  if (normalized.length) {
    await UserServiceGrant.bulkCreate(normalized);
  }
  await audit(actor.id, "SERVICE_GRANTS_UPDATE", { service_id: numericServiceId, count: normalized.length }, { req });
  return listGrantsForService(numericServiceId);
}

module.exports = {
  getAccessMapForUser,
  getAccessibleServiceIds,
  officeUserServiceScopeWhere,
  getOfficeUserIdsWithServiceAccess,
  resolveOfficeFeedbackRecipientIds,
  resolveAccessLevel,
  assertServiceAccess,
  assertRapportAccess,
  filterServiceTree,
  listGrantsForService,
  replaceServiceGrants,
  resolveNumericServiceId,
};
