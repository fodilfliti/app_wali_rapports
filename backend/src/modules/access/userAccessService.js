const {
  User,
  AccessRoleTemplate,
  AccessRoleTemplatePermission,
  UserPermissionOverride,
  Department
} = require("../../db");
const { PERMISSIONS, levelRank, permissionAppliesToAccount } = require("./permissionCatalog");
const { findByPublicId } = require("./idResolver");

async function loadUserWithAccess(userId) {
  return findByPublicId(User, userId, {
    include: [
      { model: Department, as: "department", attributes: ["id", "name_ar", "name_fr"] },
      {
        model: AccessRoleTemplate,
        as: "accessRoleTemplate",
        include: [{ model: AccessRoleTemplatePermission, as: "permissions" }]
      },
      { model: UserPermissionOverride, as: "permissionOverrides" }
    ]
  });
}

function templatePermissionsToMap(rows) {
  const m = {};
  for (const r of rows || []) m[r.permission_key] = r.access_level;
  return m;
}

async function resolveEffectivePermissions(userOrId) {
  let user = typeof userOrId === "object" && userOrId?.role ? userOrId : null;
  if (!user?.accessRoleTemplate?.permissions) {
    const id = user?.id ?? userOrId;
    user = await loadUserWithAccess(id);
  }
  if (!user) return {};

  const applicable = PERMISSIONS.filter((p) => permissionAppliesToAccount(p, user.role));

  if (!user.access_role_template_id) {
    // Legacy accounts without a template: keep prior full-manage fallback so existing
    // prod users are not locked out. New users get a template on createUser().
    const legacy = {};
    for (const p of applicable) legacy[p.key] = "manage";
    return legacy;
  }

  const template = user.accessRoleTemplate;
  const base = templatePermissionsToMap(template?.permissions);
  const effective = {};
  for (const p of applicable) effective[p.key] = base[p.key] || "none";

  if (user.use_custom_permissions && user.permissionOverrides?.length) {
    for (const o of user.permissionOverrides) {
      if (effective[o.permission_key] !== undefined) effective[o.permission_key] = o.access_level;
    }
  }
  return effective;
}

function hasPermission(effectiveMap, permissionKey, minLevel = "view") {
  const level = effectiveMap[permissionKey] || "none";
  return levelRank(level) >= levelRank(minLevel);
}

module.exports = { resolveEffectivePermissions, hasPermission, loadUserWithAccess };
