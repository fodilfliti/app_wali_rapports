const { Op } = require("sequelize");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  Municipality,
  User,
  Daira,
  Direction,
  UserServiceGrant,
  UserPermissionOverride,
  Notification,
  UserNotificationPreference,
  WebPushSubscription,
  WaliBroadcastRecipient,
  WaliInstructionRecipient,
  AccessRoleTemplate,
  sequelize,
} = require("../../db");
const { audit } = require("../../services/audit");
const { generateCredentialsPdf } = require("../../services/credentialsPdfService");
const { revokeAllForUser } = require("../auth/refreshTokenService");
const { findByPublicId, isUuid, withPublicIds, withPublicId, resolveNumericId } = require("../access/idResolver");
const { assertCan, forbidden: policyForbidden } = require("../access/assertCan");

const DEFAULT_TEMPLATE_SLUG_BY_ROLE = {
  ADMIN: "ADMIN_FULL",
  OFFICE_USER: "OFFICE_STANDARD",
  CHEF_CABINET: "CHEF_STANDARD",
  WALI: "WALI_STANDARD",
};

async function defaultAccessTemplateIdForRole(role) {
  const slug = DEFAULT_TEMPLATE_SLUG_BY_ROLE[role];
  if (!slug) return null;
  const tpl = await AccessRoleTemplate.findOne({
    where: { slug, is_active: true },
    attributes: ["id"],
  });
  return tpl?.id ?? null;
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

function forbidden(message = "Forbidden") {
  const err = new Error(message);
  err.status = 403;
  throw err;
}

function isSuperAdmin(user) {
  return Boolean(user?.is_super_admin);
}

/** Regular admins cannot manage the super-admin account. */
function assertCanManageUser(actor, target) {
  if (!target) return;
  if (target.is_super_admin && Number(actor.id) !== Number(target.id)) {
    forbidden("cannotManageSuperAdmin");
  }
}

function requireSuperAdmin(actor) {
  if (!isSuperAdmin(actor)) forbidden("superAdminRequired");
}

function refSearchWhere(q) {
  if (!q || !String(q).trim()) return {};
  const s = `%${String(q).trim()}%`;
  return {
    [Op.or]: [{ code: { [Op.iLike]: s } }, { name_ar: { [Op.iLike]: s } }, { name_fr: { [Op.iLike]: s } }]
  };
}

function applyHiddenScope(where, query) {
  if (query.hidden_only === "1" || query.hidden_only === "true") {
    where.hidden_at = { [Op.ne]: null };
  } else if (query.include_hidden === "1" || query.include_hidden === "true") {
    // no filter
  } else {
    where.hidden_at = null;
  }
  return where;
}

function notFound() {
  const err = new Error("Not found");
  err.status = 404;
  throw err;
}

function alreadyHidden() {
  const err = new Error("alreadyHidden");
  err.status = 409;
  throw err;
}

function notHidden() {
  const err = new Error("notHidden");
  err.status = 409;
  throw err;
}

async function listDairas(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = applyHiddenScope(refSearchWhere(query.q), query);
  const { rows, count } = await Daira.findAndCountAll({
    where,
    order: [["code", "ASC"]],
    offset,
    limit
  });
  return { dairas: withPublicIds(rows), total: count, page, pageSize };
}

async function createDaira(data, actor, req) {
  const row = await Daira.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code: data.code
  });
  await audit(actor.id, "DAIRA_CREATE", { daira_id: row.id, code: row.code }, { req });
  return withPublicId(row);
}

async function updateDaira(id, data, actor, req) {
  const row = await findByPublicId(Daira, id);
  if (!row) notFound();
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {})
  });
  await audit(actor.id, "DAIRA_UPDATE", { daira_id: row.id }, { req });
  return withPublicId(row);
}

async function hideDaira(id, actor, req) {
  const row = await findByPublicId(Daira, id);
  if (!row) notFound();
  if (row.hidden_at) alreadyHidden();
  const now = new Date();
  await row.update({ hidden_at: now });
  const [cascadeCount] = await Municipality.update(
    { hidden_at: now },
    { where: { daira_id: row.id, hidden_at: null } },
  );
  await audit(
    actor.id,
    "DAIRA_HIDE",
    { daira_id: row.id, communes_cascaded: cascadeCount },
    { req },
  );
  return withPublicId(row);
}

async function restoreDaira(id, actor, req) {
  const row = await findByPublicId(Daira, id);
  if (!row) notFound();
  if (!row.hidden_at) notHidden();
  await row.update({ hidden_at: null });
  const [cascadeCount] = await Municipality.update(
    { hidden_at: null },
    { where: { daira_id: row.id, hidden_at: { [Op.ne]: null } } },
  );
  await audit(
    actor.id,
    "DAIRA_RESTORE",
    { daira_id: row.id, communes_cascaded: cascadeCount },
    { req },
  );
  return withPublicId(row);
}

async function nextDirectionCode() {
  const rows = await Direction.findAll({ attributes: ["code"], raw: true });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(String(r.code || ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

async function listDirections(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = applyHiddenScope(refSearchWhere(query.q), query);
  const { rows, count } = await Direction.findAndCountAll({
    where,
    order: [["code", "ASC"]],
    offset,
    limit
  });
  return { directions: withPublicIds(rows), total: count, page, pageSize };
}

async function createDirection(data, actor, req) {
  const code = String(data.code || "").trim() || (await nextDirectionCode());
  const row = await Direction.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code
  });
  await audit(actor.id, "DIRECTION_CREATE", { direction_id: row.id, code: row.code }, { req });
  return withPublicId(row);
}

async function updateDirection(id, data, actor, req) {
  const row = await findByPublicId(Direction, id);
  if (!row) notFound();
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {})
  });
  await audit(actor.id, "DIRECTION_UPDATE", { direction_id: row.id }, { req });
  return withPublicId(row);
}

async function hideDirection(id, actor, req) {
  const row = await findByPublicId(Direction, id);
  if (!row) notFound();
  if (row.hidden_at) alreadyHidden();
  await row.update({ hidden_at: new Date() });
  await audit(actor.id, "DIRECTION_HIDE", { direction_id: row.id }, { req });
  return withPublicId(row);
}

async function restoreDirection(id, actor, req) {
  const row = await findByPublicId(Direction, id);
  if (!row) notFound();
  if (!row.hidden_at) notHidden();
  await row.update({ hidden_at: null });
  await audit(actor.id, "DIRECTION_RESTORE", { direction_id: row.id }, { req });
  return withPublicId(row);
}

async function listMunicipalities(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = applyHiddenScope(refSearchWhere(query.q), query);
  if (query.daira_id) {
    const dairaNumericId = await resolveNumericId(Daira, query.daira_id);
    if (!dairaNumericId) {
      return { municipalities: [], total: 0, page, pageSize };
    }
    where.daira_id = dairaNumericId;
  }
  const { rows, count } = await Municipality.findAndCountAll({
    where,
    order: [["code", "ASC"]],
    offset,
    limit,
    include: [{ association: "daira", attributes: ["id", "uuid", "code", "name_ar", "name_fr"] }]
  });
  return {
    municipalities: rows.map((r) => {
      const plain = withPublicId(r);
      if (plain.daira) {
        plain.daira = withPublicId(plain.daira);
        plain.daira_id = plain.daira.id;
      }
      return plain;
    }),
    total: count,
    page,
    pageSize,
  };
}

async function createMunicipality(data, actor, req) {
  const dairaNumericId = await resolveNumericId(Daira, data.daira_id);
  if (!dairaNumericId) notFound();
  const muni = await Municipality.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code: data.code,
    daira_id: dairaNumericId
  });
  await audit(actor.id, "MUNICIPALITY_CREATE", { municipality_id: muni.id, code: muni.code }, { req });
  return withPublicId(muni);
}

async function updateMunicipality(id, data, actor, req) {
  const muni = await findByPublicId(Municipality, id);
  if (!muni) notFound();
  let nextDairaId;
  if (data.daira_id != null) {
    nextDairaId = await resolveNumericId(Daira, data.daira_id);
    if (!nextDairaId) notFound();
  }
  await muni.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {}),
    ...(data.daira_id != null ? { daira_id: nextDairaId } : {})
  });
  await audit(actor.id, "MUNICIPALITY_UPDATE", { municipality_id: muni.id }, { req });
  return withPublicId(muni);
}

async function hideMunicipality(id, actor, req) {
  const muni = await findByPublicId(Municipality, id);
  if (!muni) notFound();
  if (muni.hidden_at) alreadyHidden();
  await muni.update({ hidden_at: new Date() });
  await audit(actor.id, "MUNICIPALITY_HIDE", { municipality_id: muni.id }, { req });
  return withPublicId(muni);
}

async function restoreMunicipality(id, actor, req) {
  const muni = await findByPublicId(Municipality, id);
  if (!muni) notFound();
  if (!muni.hidden_at) notHidden();
  await muni.update({ hidden_at: null });
  await audit(actor.id, "MUNICIPALITY_RESTORE", { municipality_id: muni.id }, { req });
  return withPublicId(muni);
}

function userSearchWhere(q, role) {
  const where = { deleted_at: null };
  if (role) where.role = role;
  if (q && String(q).trim()) {
    const s = `%${String(q).trim()}%`;
    where[Op.or] = [{ username: { [Op.iLike]: s } }, { name: { [Op.iLike]: s } }];
  }
  return where;
}

async function listUsers(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = userSearchWhere(query.q, query.role);
  const { rows, count } = await User.findAndCountAll({
    where,
    order: [["id", "ASC"]],
    offset,
    limit,
    include: [{ association: "department", attributes: ["id", "uuid", "name_ar", "name_fr"] }]
  });
  return {
    users: rows.map((u) => {
      const plain = withPublicId(u);
      if (plain.department) plain.department = withPublicId(plain.department);
      return plain;
    }),
    total: count,
    page,
    pageSize,
  };
}

function randomPassword8() {
  // Cryptographically strong 8-digit code (same display format as before).
  const n = crypto.randomInt(10_000_000, 100_000_000);
  return String(n);
}

async function createUser(data, actor, req) {
  try {
    assertCan(actor, "organization.users.manage");
  } catch {
    if (actor.role !== "ADMIN") throw policyForbidden();
  }
  const existing = await User.findOne({ where: { username: data.username } });
  if (existing) {
    const err = new Error("errorUsernameExists");
    err.status = 409;
    throw err;
  }
  const access_role_template_id =
    data.access_role_template_id != null
      ? data.access_role_template_id
      : await defaultAccessTemplateIdForRole(data.role);
  const initialPassword = randomPassword8();
  const user = await User.create({
    username: data.username,
    name: data.name,
    role: data.role,
    department_id: data.department_id ?? null,
    job_title: data.job_title ?? null,
    access_role_template_id,
    password_hash: await bcrypt.hash(initialPassword, 10),
    is_blocked: false
  });
  const pdf = await generateCredentialsPdf({
    username: user.username,
    name: user.name,
    role: user.role,
    jobTitle: user.job_title,
    code8: initialPassword
  });
  await audit(
    actor.id,
    "USER_CREATE",
    {
      user_id: user.id,
      role: user.role,
      access_role_template_id,
      pdf_url: pdf.file_url,
    },
    { req }
  );
  return {
    user,
    initialPassword,
    credentials: { code8: initialPassword, pdf_url: pdf.file_url }
  };
}

async function updateUser(id, data, actor, req) {
  const user = await findByPublicId(User, id);
  if (!user || user.deleted_at) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  assertCanManageUser(actor, user);
  await user.update({
    ...(data.name != null ? { name: data.name } : {}),
    ...(data.department_id !== undefined ? { department_id: data.department_id } : {}),
    ...(data.job_title !== undefined ? { job_title: data.job_title } : {})
  });
  await audit(actor.id, "USER_UPDATE", { user_id: user.id }, { req });
  return user;
}

async function toggleBlockUser(id, actor, req) {
  const user = await findByPublicId(User, id);
  if (!user || user.deleted_at) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (Number(user.id) === Number(actor.id)) {
    const err = new Error("Cannot block self");
    err.status = 400;
    throw err;
  }
  assertCanManageUser(actor, user);
  await user.update({ is_blocked: !user.is_blocked });
  if (user.is_blocked) {
    await revokeAllForUser(user.id);
  }
  await audit(actor.id, "USER_BLOCK", { user_id: user.id, is_blocked: user.is_blocked }, { req });
  return user;
}

async function resetUserPassword(id, actor, req) {
  const user = await User.scope("withPassword").findOne({
    where: isUuid(String(id)) ? { uuid: id } : { id: Number(id) },
  });
  if (!user || user.deleted_at) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  assertCanManageUser(actor, user);
  const newPassword = randomPassword8();
  await user.update({ password_hash: await bcrypt.hash(newPassword, 10) });
  await revokeAllForUser(user.id);
  const pdf = await generateCredentialsPdf({
    username: user.username,
    name: user.name,
    role: user.role,
    jobTitle: user.job_title,
    code8: newPassword
  });
  await audit(
    actor.id,
    "USER_PASSWORD_RESET",
    { user_id: user.id, pdf_url: pdf.file_url },
    { req }
  );
  return {
    user,
    newPassword,
    credentials: { code8: newPassword, pdf_url: pdf.file_url }
  };
}

/**
 * Soft-delete: keep users row for FKs; clear grants/sessions/personal notifs.
 * Super-admin only. Cannot delete self or another super-admin.
 */
async function softDeleteUser(id, actor, req) {
  requireSuperAdmin(actor);
  const user = await findByPublicId(User, id);
  if (!user || user.deleted_at) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (Number(user.id) === Number(actor.id)) {
    const err = new Error("cannotDeleteSelf");
    err.status = 400;
    throw err;
  }
  if (user.is_super_admin) {
    forbidden("cannotDeleteSuperAdmin");
  }

  const userId = user.id;
  await sequelize.transaction(async (transaction) => {
    await user.update(
      { deleted_at: new Date(), is_blocked: true },
      { transaction },
    );
    await UserServiceGrant.destroy({ where: { user_id: userId }, transaction });
    await UserPermissionOverride.destroy({ where: { user_id: userId }, transaction });
    await Notification.destroy({ where: { user_id: userId }, transaction });
    await UserNotificationPreference.destroy({ where: { user_id: userId }, transaction });
    await WebPushSubscription.destroy({ where: { user_id: userId }, transaction });
    await WaliBroadcastRecipient.destroy({ where: { user_id: userId }, transaction });
    await WaliInstructionRecipient.destroy({ where: { user_id: userId }, transaction });
  });
  await revokeAllForUser(userId);
  await audit(
    actor.id,
    "USER_SOFT_DELETE",
    { user_id: userId, role: user.role, username: user.username },
    { req },
  );
  return { ok: true, user_id: userId };
}

module.exports = {
  listDairas,
  createDaira,
  updateDaira,
  hideDaira,
  restoreDaira,
  listDirections,
  createDirection,
  updateDirection,
  hideDirection,
  restoreDirection,
  listMunicipalities,
  createMunicipality,
  updateMunicipality,
  hideMunicipality,
  restoreMunicipality,
  listUsers,
  createUser,
  updateUser,
  toggleBlockUser,
  resetUserPassword,
  softDeleteUser,
  isSuperAdmin,
  assertCanManageUser,
  requireSuperAdmin,
};
