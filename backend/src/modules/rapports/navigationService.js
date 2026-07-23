const { Op } = require("sequelize");
const { User, Service, Department, Rapport, RapportType, UserServiceGrant } = require("../../db");
const { getAccessMapForUser, filterServiceTree } = require("./serviceAccessService");
const hubCountsService = require("./hubCountsService");
const { publicId, findByPublicId, withPublicId } = require("../access/idResolver");

function serializeServiceNode(s, includeChildren = true) {
  // Keep BIGINT ids here: hubCounts enrichServiceTreeCounts keys by Number(id).
  // uuid kept for toPublicServiceTree conversion after counts.
  const node = {
    id: s.id,
    uuid: s.uuid,
    slug: s.slug,
    name_ar: s.name_ar,
    name_fr: s.name_fr,
    is_folder: s.is_folder,
    parent_service_id: s.parent_service_id,
    access_level: s.access_level,
    rapportTypes: (s.rapportTypes || []).map((t) => ({
      id: t.id,
      uuid: t.uuid,
      slug: t.slug,
      name_ar: t.name_ar,
      name_fr: t.name_fr,
      content_kind: t.content_kind,
      versioning_mode: t.versioning_mode
    }))
  };
  if (includeChildren && s.children?.length) {
    node.children = s.children.map((c) => serializeServiceNode(c, true));
  }
  return node;
}

/** Build BIGINT service id → uuid map from a (possibly nested) tree. */
function collectServiceIdUuidMap(nodes, map = new Map()) {
  for (const n of nodes || []) {
    const numericId = Number(n.id);
    if (Number.isFinite(numericId) && numericId > 0) {
      map.set(numericId, n.uuid ? String(n.uuid) : String(n.id));
    }
    if (n.children?.length) collectServiceIdUuidMap(n.children, map);
  }
  return map;
}

/**
 * After hubCounts (keyed by numeric ids), expose public UUIDs for FE card links.
 */
function toPublicServiceTree(nodes, idToUuidMap) {
  return (nodes || []).map((node) => {
    const numericId = Number(node.id);
    const { uuid: _uuid, children, rapportTypes, ...rest } = node;
    const parentNumeric =
      node.parent_service_id != null ? Number(node.parent_service_id) : null;
    return {
      ...rest,
      id: idToUuidMap.get(numericId) || (node.uuid ? String(node.uuid) : String(node.id)),
      parent_service_id:
        parentNumeric != null
          ? idToUuidMap.get(parentNumeric) || String(node.parent_service_id)
          : null,
      rapportTypes: (rapportTypes || []).map((t) => {
        const { uuid: typeUuid, ...typeRest } = t;
        return {
          ...typeRest,
          id: typeUuid ? String(typeUuid) : String(t.id),
        };
      }),
      children: children?.length ? toPublicServiceTree(children, idToUuidMap) : children,
    };
  });
}

function finalizeServiceTree(serializedNodes) {
  const idToUuidMap = collectServiceIdUuidMap(serializedNodes);
  return toPublicServiceTree(serializedNodes, idToUuidMap);
}

/**
 * Pending count per office user = inbox rapports in that user's granted services
 * (grantee lens; co-grantees share the same pending work).
 * @param {string[]} [statusList] — if omitted, use `whereExtra` only
 * @param {object} [whereExtra] — extra Sequelize where (e.g. delete requests)
 */
async function pendingCountsByOfficeUser(statusList, whereExtra = null) {
  const grants = await UserServiceGrant.findAll({
    attributes: ["user_id", "service_id"],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id"],
        required: true,
        where: { role: "OFFICE_USER", is_blocked: false, deleted_at: null },
      },
    ],
  });
  const servicesByUser = new Map();
  for (const g of grants) {
    const uid = Number(g.user_id);
    const sid = Number(g.service_id);
    if (!uid || !sid) continue;
    if (!servicesByUser.has(uid)) servicesByUser.set(uid, new Set());
    servicesByUser.get(uid).add(sid);
  }
  if (!servicesByUser.size) return {};

  const allServiceIds = [
    ...new Set([...servicesByUser.values()].flatMap((s) => [...s])),
  ];
  const where = {
    hidden_at: null,
    service_id: { [Op.in]: allServiceIds },
    ...(whereExtra || {}),
  };
  if (statusList?.length && !whereExtra) {
    where.status = { [Op.in]: statusList };
  }
  const pendingByService = await Rapport.findAll({
    attributes: [
      "service_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "pending_count"],
    ],
    where,
    group: ["service_id"],
    raw: true,
  });
  const countByService = {};
  for (const row of pendingByService) {
    countByService[Number(row.service_id)] = Number(row.pending_count) || 0;
  }

  const countByUser = {};
  for (const [uid, serviceIds] of servicesByUser) {
    let total = 0;
    for (const sid of serviceIds) {
      total += countByService[sid] || 0;
    }
    countByUser[uid] = total;
  }
  return countByUser;
}

async function listOfficeUsersForWali(statusList = hubCountsService.WALI_INBOX_ACTION_STATUSES) {
  const users = await User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false, deleted_at: null },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "uuid", "username", "name", "job_title", "department_id"],
    include: [{ model: Department, as: "department", attributes: ["id", "uuid", "name_ar", "name_fr"] }]
  });

  const countByUser = await pendingCountsByOfficeUser(statusList);

  return users.map((u) => ({
    id: publicId(u),
    username: u.username,
    name: u.name,
    job_title: u.job_title,
    department: u.department ? withPublicId(u.department) : null,
    pending_rapports_count: countByUser[Number(u.id)] || 0
  }));
}

async function listOfficeUsersForChef() {
  const users = await User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false, deleted_at: null },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "uuid", "username", "name", "job_title", "department_id"],
    include: [{ model: Department, as: "department", attributes: ["id", "uuid", "name_ar", "name_fr"] }],
  });

  const countByUser = await pendingCountsByOfficeUser(null, {
    ...hubCountsService.chefActionOrDeleteWhere(),
  });

  return users.map((u) => ({
    id: publicId(u),
    username: u.username,
    name: u.name,
    job_title: u.job_title,
    department: u.department ? withPublicId(u.department) : null,
    pending_rapports_count: countByUser[Number(u.id)] || 0,
  }));
}

async function loadFullServiceTree() {
  return Service.findAll({
    where: { is_active: true, parent_service_id: null },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: RapportType,
        as: "rapportTypes",
        attributes: ["id", "uuid", "slug", "name_ar", "name_fr", "content_kind", "versioning_mode"],
      },
      {
        model: Service,
        as: "children",
        where: { is_active: true },
        required: false,
        include: [
          {
            model: RapportType,
            as: "rapportTypes",
            attributes: ["id", "uuid", "slug", "name_ar", "name_fr", "content_kind", "versioning_mode"],
          },
        ],
      },
    ],
  });
}

async function getServiceTreeForUser(userId, actorRole = "OFFICE_USER", opts = {}) {
  const services = await loadFullServiceTree();
  const userRow = userId
    ? await findByPublicId(User, userId, { attributes: ["id", "uuid"] })
    : null;
  const numericUserId = userRow?.id ?? null;
  const publicUserId = userRow ? publicId(userRow) : null;

  if (actorRole === "ADMIN") {
    const serialized = services.map((s) =>
      serializeServiceNode({ ...s.toJSON(), access_level: "manage" }),
    );
    return {
      office_user_id: publicUserId ?? (userId != null ? String(userId) : null),
      services: finalizeServiceTree(serialized),
    };
  }

  if (!numericUserId) {
    return { office_user_id: null, services: [] };
  }

  const accessMap = await getAccessMapForUser(numericUserId);
  const filtered = filterServiceTree(services, accessMap);
  const serialized = filtered.map((s) => serializeServiceNode(s));
  const counts = opts.forChef
    ? await hubCountsService.getChefServicePendingCounts(numericUserId)
    : await hubCountsService.getWaliServicePendingCounts(numericUserId);
  const withCounts = hubCountsService.applyServiceActionCounts(
    serialized,
    counts.byService,
    counts.byType,
  );
  return {
    office_user_id: publicUserId,
    services: finalizeServiceTree(withCounts),
  };
}

async function getOfficeServiceTree(user) {
  let services;
  if (user.role === "ADMIN") {
    const rows = await loadFullServiceTree();
    services = rows.map((s) => serializeServiceNode({ ...s.toJSON(), access_level: "manage" }));
  } else {
    const accessMap = await getAccessMapForUser(user.id);
    const filtered = filterServiceTree(await loadFullServiceTree(), accessMap);
    services = filtered.map((s) => serializeServiceNode(s));
  }
  const counts = await hubCountsService.getOfficeServiceActionCounts(user.id);
  const withCounts = hubCountsService.applyServiceActionCounts(
    services,
    counts.byService,
    counts.byType,
  );
  return { services: finalizeServiceTree(withCounts) };
}

module.exports = {
  listOfficeUsersForWali,
  listOfficeUsersForChef,
  getServiceTreeForUser,
  getOfficeServiceTree,
  toPublicServiceTree,
  collectServiceIdUuidMap,
};
