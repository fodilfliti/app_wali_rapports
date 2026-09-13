const { WorkflowRoleSetting } = require("../../db");
const { CREATOR_ROLES, isCreatorRole } = require("../access/creatorRoles");
const { audit } = require("../../services/audit");

async function listWorkflowRoleSettings() {
  const rows = await WorkflowRoleSetting.findAll({
    order: [["role", "ASC"]],
  });
  const byRole = Object.fromEntries(rows.map((r) => [r.role, r.chef_validate]));
  return CREATOR_ROLES.map((role) => ({
    role,
    chef_validate: byRole[role] !== false,
  }));
}

/** Default true when row missing (safe for existing Wilaya path). */
async function isChefValidateEnabled(role) {
  if (!isCreatorRole(role)) return true;
  const row = await WorkflowRoleSetting.findByPk(role);
  if (!row) return true;
  return row.chef_validate !== false;
}

async function updateWorkflowRoleSettings(updates, actor, req) {
  if (!Array.isArray(updates)) {
    const err = new Error("Invalid body");
    err.status = 400;
    throw err;
  }
  const now = new Date();
  const results = [];
  for (const item of updates) {
    const role = item?.role;
    if (!isCreatorRole(role)) continue;
    const chef_validate = item.chef_validate !== false && item.chef_validate !== "0";
    const upsertResult = await WorkflowRoleSetting.upsert({
      role,
      chef_validate: Boolean(chef_validate),
      updated_at: now,
    });
    // Sequelize upsert returns [instance, created] (or just instance on some dialects).
    const row = Array.isArray(upsertResult) ? upsertResult[0] : upsertResult;
    results.push({
      role,
      chef_validate: row ? Boolean(row.chef_validate) : Boolean(chef_validate),
    });
  }
  await audit(
    actor.id,
    "WORKFLOW_ROLE_SETTINGS_UPDATE",
    { updates: results },
    { req }
  );
  return listWorkflowRoleSettings();
}

module.exports = {
  listWorkflowRoleSettings,
  isChefValidateEnabled,
  updateWorkflowRoleSettings,
};
