const { Op } = require("sequelize");
const { User, Service, Department, Rapport, RapportType, UserServiceGrant } = require("../../db");
const { getAccessMapForUser, filterServiceTree } = require("./serviceAccessService");
const hubCountsService = require("./hubCountsService");

function serializeServiceNode(s, includeChildren = true) {
  const node = {
    id: s.id,
    slug: s.slug,
    name_ar: s.name_ar,
    name_fr: s.name_fr,
    is_folder: s.is_folder,
    parent_service_id: s.parent_service_id,
    access_level: s.access_level,
    rapportTypes: (s.rapportTypes || []).map((t) => ({
      id: t.id,
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

/**
 * Pending count per office user = inbox rapports in that user's granted services
 * (grantee lens; co-grantees share the same pending work).
 */
async function pendingCountsByOfficeUser(statusList) {
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
  const pendingByService = await Rapport.findAll({
    attributes: [
      "service_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "pending_count"],
    ],
    where: {
      status: { [Op.in]: statusList },
      hidden_at: null,
      service_id: { [Op.in]: allServiceIds },
    },
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
    attributes: ["id", "username", "name", "job_title", "department_id"],
    include: [{ model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }]
  });

  const countByUser = await pendingCountsByOfficeUser(statusList);

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    job_title: u.job_title,
    department: u.department,
    pending_rapports_count: countByUser[Number(u.id)] || 0
  }));
}

async function listOfficeUsersForChef() {
  return listOfficeUsersForWali(hubCountsService.CHEF_INBOX_ACTION_STATUSES);
}

async function loadFullServiceTree() {
  return Service.findAll({
    where: { is_active: true, parent_service_id: null },
    order: [["sort_order", "ASC"], ["id", "ASC"]],
    include: [
      { model: RapportType, as: "rapportTypes", attributes: ["id", "slug", "name_ar", "name_fr", "content_kind", "versioning_mode"] },
      {
        model: Service,
        as: "children",
        where: { is_active: true },
        required: false,
        include: [
          { model: RapportType, as: "rapportTypes", attributes: ["id", "slug", "name_ar", "name_fr", "content_kind", "versioning_mode"] }
        ]
      }
    ]
  });
}

async function getServiceTreeForUser(userId, actorRole = "OFFICE_USER", opts = {}) {
  const services = await loadFullServiceTree();

  if (actorRole === "ADMIN") {
    return {
      office_user_id: userId,
      services: services.map((s) => serializeServiceNode({ ...s.toJSON(), access_level: "manage" }))
    };
  }

  const targetUserId = userId || null;
  if (!targetUserId) {
    return { office_user_id: null, services: [] };
  }

  const accessMap = await getAccessMapForUser(targetUserId);
  const filtered = filterServiceTree(services, accessMap);
  const serialized = filtered.map((s) => serializeServiceNode(s));
  const counts = opts.forChef
    ? await hubCountsService.getChefServicePendingCounts(targetUserId)
    : await hubCountsService.getWaliServicePendingCounts(targetUserId);
  return {
    office_user_id: targetUserId,
    services: hubCountsService.applyServiceActionCounts(serialized, counts.byService, counts.byType)
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
  return { services: hubCountsService.applyServiceActionCounts(services, counts.byService, counts.byType) };
}

module.exports = {
  listOfficeUsersForWali,
  listOfficeUsersForChef,
  getServiceTreeForUser,
  getOfficeServiceTree,
};
