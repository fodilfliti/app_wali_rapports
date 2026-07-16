const { Op } = require("sequelize");
const { Rapport, RapportType, Notification, WaliBroadcastRecipient } = require("../../db");
const { getAccessMapForUser } = require("./serviceAccessService");
const { DEDICATED_NOTIFICATION_KEYS } = require("./notificationKeys");

const WALI_INBOX_ACTION_STATUSES = ["submitted", "under_review"];
const CHEF_INBOX_ACTION_STATUSES = ["pending_chef"];

function waliInboxActionWhere() {
  return {
    status: { [Op.in]: WALI_INBOX_ACTION_STATUSES },
    hidden_at: null,
  };
}

function chefInboxActionWhere() {
  return {
    status: { [Op.in]: CHEF_INBOX_ACTION_STATUSES },
    hidden_at: null,
  };
}

function mergeCountMaps(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] || 0) + Number(v);
  }
  return out;
}

let ficheLectureTypeIdsCache = null;

async function getFicheLectureTypeIds() {
  if (ficheLectureTypeIdsCache) return ficheLectureTypeIdsCache;
  const types = await RapportType.findAll({
    where: { content_kind: "fiche_lecture" },
    attributes: ["id"],
    raw: true,
  });
  ficheLectureTypeIdsCache = types.map((t) => Number(t.id));
  return ficheLectureTypeIdsCache;
}

async function getAccessibleServiceIds(userId) {
  const accessMap = await getAccessMapForUser(userId);
  return Object.keys(accessMap).map(Number).filter(Boolean);
}

async function loadSharedFicheCounts(allowedServiceIds, statusWhere) {
  const typeIds = await getFicheLectureTypeIds();
  if (!typeIds.length || !allowedServiceIds?.length) {
    return { byService: {}, byType: {} };
  }
  const whereExtra = {
    ...statusWhere,
    owner_office_user_id: null,
    rapport_type_id: { [Op.in]: typeIds },
    service_id: { [Op.in]: allowedServiceIds },
    hidden_at: null,
  };
  const [byService, byType] = await Promise.all([
    loadRapportCountsByService(whereExtra),
    loadRapportCountsByServiceAndType(whereExtra),
  ]);
  return { byService, byType };
}

async function countUnreadNotifications(userId) {
  return Notification.count({
    where: {
      user_id: userId,
      read_at: null,
      message_key: { [Op.notIn]: DEDICATED_NOTIFICATION_KEYS },
    },
  });
}

async function countOfficeChangesRequested(userId) {
  const [owned, serviceIds, typeIds] = await Promise.all([
    Rapport.count({
      where: {
        owner_office_user_id: userId,
        status: "changes_requested",
        hidden_at: null,
      },
    }),
    getAccessibleServiceIds(userId),
    getFicheLectureTypeIds(),
  ]);
  if (!serviceIds.length || !typeIds.length) return owned;
  const shared = await Rapport.count({
    where: {
      owner_office_user_id: null,
      status: "changes_requested",
      hidden_at: null,
      service_id: { [Op.in]: serviceIds },
      rapport_type_id: { [Op.in]: typeIds },
    },
  });
  return owned + shared;
}

async function countUnreadSharedFiles(userId) {
  return WaliBroadcastRecipient.count({
    where: { user_id: userId, read_at: null },
  });
}

async function countWaliInboxPending() {
  return Rapport.count({ where: waliInboxActionWhere() });
}

async function countChefInboxPending() {
  return Rapport.count({ where: chefInboxActionWhere() });
}

async function countUnreadInstructions(userId) {
  const { WaliInstructionRecipient } = require("../../db");
  return WaliInstructionRecipient.count({
    where: { user_id: userId, read_at: null },
  });
}

async function loadRapportCountsByService(whereExtra) {
  const rows = await Rapport.findAll({
    attributes: ["service_id", [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "count"]],
    where: {
      service_id: { [Op.ne]: null },
      ...whereExtra,
    },
    group: ["service_id"],
    raw: true,
  });
  return Object.fromEntries(rows.map((r) => [Number(r.service_id), Number(r.count)]));
}

async function loadRapportCountsByServiceAndType(whereExtra) {
  const rows = await Rapport.findAll({
    attributes: [
      "service_id",
      "rapport_type_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "count"],
    ],
    where: {
      service_id: { [Op.ne]: null },
      rapport_type_id: { [Op.ne]: null },
      ...whereExtra,
    },
    group: ["service_id", "rapport_type_id"],
    raw: true,
  });
  return Object.fromEntries(
    rows.map((r) => [`${Number(r.service_id)}:${Number(r.rapport_type_id)}`, Number(r.count)]),
  );
}

function enrichServiceTreeCounts(nodes, countByService, countByType = {}) {
  return nodes.map((node) => {
    const id = Number(node.id);
    const children = node.children?.length
      ? enrichServiceTreeCounts(node.children, countByService, countByType)
      : node.children;
    const rapportTypes = (node.rapportTypes || []).map((t) => ({
      ...t,
      action_count: Number(countByType[`${id}:${Number(t.id)}`]) || 0,
    }));
    if (node.is_folder && children?.length) {
      const action_count = children.reduce((sum, c) => sum + (c.action_count || 0), 0);
      return { ...node, children, rapportTypes, action_count };
    }
    if (!node.is_folder) {
      return { ...node, children, rapportTypes, action_count: countByService[id] || 0 };
    }
    return { ...node, children, rapportTypes, action_count: 0 };
  });
}

function applyServiceActionCounts(nodes, countByService, countByType) {
  if (countByType) return enrichServiceTreeCounts(nodes, countByService, countByType);
  return enrichServiceTreeCounts(nodes, countByService, {});
}

async function getOfficeHubCounts(userId) {
  const [
    unread_notifications,
    changes_requested_rapports,
    unread_shared_files,
    unread_instructions,
    serviceCounts,
  ] = await Promise.all([
    countUnreadNotifications(userId),
    countOfficeChangesRequested(userId),
    countUnreadSharedFiles(userId),
    countUnreadInstructions(userId),
    getOfficeServiceActionCounts(userId),
  ]);
  const services_action_count = Object.values(serviceCounts.byService).filter((c) => c > 0).length;
  return {
    unread_notifications,
    changes_requested_rapports,
    unread_shared_files,
    unread_instructions,
    services_action_count,
  };
}

async function countWaliOfficeUsersWithPending() {
  const rows = await Rapport.findAll({
    attributes: [
      "owner_office_user_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "pending_count"],
    ],
    where: {
      ...waliInboxActionWhere(),
      owner_office_user_id: { [Op.ne]: null },
    },
    group: ["owner_office_user_id"],
    raw: true,
  });
  return rows.length;
}

async function countChefOfficeUsersWithPending() {
  const rows = await Rapport.findAll({
    attributes: [
      "owner_office_user_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "pending_count"],
    ],
    where: {
      ...chefInboxActionWhere(),
      owner_office_user_id: { [Op.ne]: null },
    },
    group: ["owner_office_user_id"],
    raw: true,
  });
  return rows.length;
}

async function countUnreadDiscussion(userId, opts = {}) {
  if (!userId) return 0;
  const rows = await Notification.findAll({
    where: {
      user_id: userId,
      message_key: "rapportComment",
      read_at: null,
      rapport_id: { [Op.ne]: null },
    },
    attributes: ["rapport_id"],
    group: ["rapport_id"],
    raw: true,
  });
  const ids = rows.map((r) => Number(r.rapport_id)).filter(Boolean);
  if (!ids.length) return 0;

  const where = {
    id: { [Op.in]: ids },
    hidden_at: null,
    status: { [Op.ne]: "draft" },
  };
  // Wali never sees pending_chef threads — keep badge aligned with inbox visibility
  if (opts.forWali) {
    where.status = { [Op.notIn]: ["pending_chef", "draft"] };
  }

  return Rapport.count({ where });
}

async function getWaliHubCounts(userId) {
  const [inbox_pending, office_users_pending, unread_discussion] = await Promise.all([
    countWaliInboxPending(),
    countWaliOfficeUsersWithPending(),
    countUnreadDiscussion(userId, { forWali: true }),
  ]);
  return { inbox_pending, office_users_pending, unread_discussion };
}

async function getChefHubCounts(userId) {
  const [inbox_pending, office_users_pending, unread_discussion] = await Promise.all([
    countChefInboxPending(),
    countChefOfficeUsersWithPending(),
    countUnreadDiscussion(userId),
  ]);
  return { inbox_pending, office_users_pending, unread_discussion };
}

async function getOfficeServiceActionCounts(userId) {
  const ownedWhere = {
    owner_office_user_id: userId,
    status: "changes_requested",
    hidden_at: null,
  };
  const [ownedByService, ownedByType, serviceIds] = await Promise.all([
    loadRapportCountsByService(ownedWhere),
    loadRapportCountsByServiceAndType(ownedWhere),
    getAccessibleServiceIds(userId),
  ]);
  const shared = await loadSharedFicheCounts(serviceIds, { status: "changes_requested" });
  return {
    byService: mergeCountMaps(ownedByService, shared.byService),
    byType: mergeCountMaps(ownedByType, shared.byType),
  };
}

async function getWaliServicePendingCounts(officeUserId) {
  const ownedWhere = {
    owner_office_user_id: officeUserId,
    ...waliInboxActionWhere(),
  };
  const [ownedByService, ownedByType, serviceIds] = await Promise.all([
    loadRapportCountsByService(ownedWhere),
    loadRapportCountsByServiceAndType(ownedWhere),
    getAccessibleServiceIds(officeUserId),
  ]);
  const shared = await loadSharedFicheCounts(serviceIds, waliInboxActionWhere());
  return {
    byService: mergeCountMaps(ownedByService, shared.byService),
    byType: mergeCountMaps(ownedByType, shared.byType),
  };
}

async function getChefServicePendingCounts(officeUserId) {
  const ownedWhere = {
    owner_office_user_id: officeUserId,
    ...chefInboxActionWhere(),
  };
  const [ownedByService, ownedByType, serviceIds] = await Promise.all([
    loadRapportCountsByService(ownedWhere),
    loadRapportCountsByServiceAndType(ownedWhere),
    getAccessibleServiceIds(officeUserId),
  ]);
  const shared = await loadSharedFicheCounts(serviceIds, chefInboxActionWhere());
  return {
    byService: mergeCountMaps(ownedByService, shared.byService),
    byType: mergeCountMaps(ownedByType, shared.byType),
  };
}

module.exports = {
  WALI_INBOX_ACTION_STATUSES,
  CHEF_INBOX_ACTION_STATUSES,
  DEDICATED_NOTIFICATION_KEYS,
  waliInboxActionWhere,
  chefInboxActionWhere,
  getOfficeHubCounts,
  getWaliHubCounts,
  getChefHubCounts,
  applyServiceActionCounts,
  getOfficeServiceActionCounts,
  getWaliServicePendingCounts,
  getChefServicePendingCounts,
};
