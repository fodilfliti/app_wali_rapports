const { resolveEffectivePermissions } = require("./userAccessService");
const { publicId } = require("./idResolver");

async function enrichSessionUser(user) {
  const effective_permissions = await resolveEffectivePermissions(user);
  return {
    id: publicId(user),
    username: user.username,
    name: user.name,
    role: user.role,
    is_blocked: user.is_blocked,
    is_super_admin: Boolean(user.is_super_admin),
    job_title: user.job_title,
    department: user.department
      ? { id: user.department.id, name_ar: user.department.name_ar, name_fr: user.department.name_fr }
      : null,
    effective_permissions
  };
}

module.exports = { enrichSessionUser };
