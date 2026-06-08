const { resolveEffectivePermissions } = require("./userAccessService");

async function enrichSessionUser(user) {
  const effective_permissions = await resolveEffectivePermissions(user);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    is_blocked: user.is_blocked,
    job_title: user.job_title,
    department: user.department
      ? { id: user.department.id, name_ar: user.department.name_ar, name_fr: user.department.name_fr }
      : null,
    effective_permissions
  };
}

module.exports = { enrichSessionUser };
