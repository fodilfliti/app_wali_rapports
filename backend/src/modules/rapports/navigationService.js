const { Op } = require("sequelize");
const { User, Service, Department, Rapport, RapportType } = require("../../db");
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

async function listOfficeUsersForWali(statusList = hubCountsService.WALI_INBOX_ACTION_STATUSES) {
  const users = await User.findAll({
    where: { role: "OFFICE_USER", is_blocked: false },
    order: [["name", "ASC"], ["id", "ASC"]],
    attributes: ["id", "username", "name", "job_title", "department_id"],
    include: [{ model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] }]
  });

  const counts = await Rapport.findAll({
    attributes: [
      "owner_office_user_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "pending_count"]
    ],
    where: {
      status: { [Op.in]: statusList },
      owner_office_user_id: { [Op.ne]: null },
      hidden_at: null,
    },
    group: ["owner_office_user_id"],
    raw: true
  });
  const countByUser = Object.fromEntries(counts.map((c) => [c.owner_office_user_id, Number(c.pending_count)]));

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    job_title: u.job_title,
    department: u.department,
    pending_rapports_count: countByUser[u.id] || 0
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
