const { Op } = require("sequelize");
const { Rapport, Notification, WaliBroadcastRecipient } = require("../../db");

async function countUnreadNotifications(userId) {
  return Notification.count({ where: { user_id: userId, read_at: null } });
}

async function countOfficeChangesRequested(userId) {
  return Rapport.count({
    where: {
      owner_office_user_id: userId,
      status: "changes_requested"
    }
  });
}

async function countUnreadSharedFiles(userId) {
  return WaliBroadcastRecipient.count({
    where: { user_id: userId, read_at: null }
  });
}

async function countWaliInboxPending() {
  return Rapport.count({
    where: { status: "submitted", hidden_at: null },
  });
}

async function loadRapportCountsByService(whereExtra) {
  const rows = await Rapport.findAll({
    attributes: ["service_id", [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "count"]],
    where: {
      service_id: { [Op.ne]: null },
      ...whereExtra
    },
    group: ["service_id"],
    raw: true
  });
  return Object.fromEntries(rows.map((r) => [Number(r.service_id), Number(r.count)]));
}

async function loadRapportCountsByServiceAndType(whereExtra) {
  const rows = await Rapport.findAll({
    attributes: [
      "service_id",
      "rapport_type_id",
      [Rapport.sequelize.fn("COUNT", Rapport.sequelize.col("id")), "count"]
    ],
    where: {
      service_id: { [Op.ne]: null },
      rapport_type_id: { [Op.ne]: null },
      ...whereExtra
    },
    group: ["service_id", "rapport_type_id"],
    raw: true
  });
  return Object.fromEntries(
    rows.map((r) => [`${Number(r.service_id)}:${Number(r.rapport_type_id)}`, Number(r.count)])
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
      action_count: Number(countByType[`${id}:${Number(t.id)}`]) || 0
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
  const [unread_notifications, changes_requested_rapports, unread_shared_files, serviceCounts] =
    await Promise.all([
      countUnreadNotifications(userId),
      countOfficeChangesRequested(userId),
      countUnreadSharedFiles(userId),
      getOfficeServiceActionCounts(userId)
    ]);
  const services_action_count = Object.values(serviceCounts.byService).filter((c) => c > 0).length;
  return { unread_notifications, changes_requested_rapports, unread_shared_files, services_action_count };
}

async function countWaliOfficeUsersPending() {
  return Rapport.count({
    where: {
      status: "submitted",
      owner_office_user_id: { [Op.ne]: null },
      hidden_at: null,
    },
  });
}

async function getWaliHubCounts() {
  const [inbox_pending, office_users_pending] = await Promise.all([
    countWaliInboxPending(),
    countWaliOfficeUsersPending()
  ]);
  return { inbox_pending, office_users_pending };
}

async function getOfficeServiceActionCounts(userId) {
  const where = {
    owner_office_user_id: userId,
    status: "changes_requested"
  };
  const [byService, byType] = await Promise.all([
    loadRapportCountsByService(where),
    loadRapportCountsByServiceAndType(where)
  ]);
  return { byService, byType };
}

async function getWaliServicePendingCounts(officeUserId) {
  const where = {
    owner_office_user_id: officeUserId,
    status: "submitted",
    hidden_at: null,
  };
  const [byService, byType] = await Promise.all([
    loadRapportCountsByService(where),
    loadRapportCountsByServiceAndType(where)
  ]);
  return { byService, byType };
}

module.exports = {
  getOfficeHubCounts,
  getWaliHubCounts,
  applyServiceActionCounts,
  getOfficeServiceActionCounts,
  getWaliServicePendingCounts
};
