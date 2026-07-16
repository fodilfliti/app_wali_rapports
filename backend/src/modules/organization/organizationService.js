const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { Municipality, User, Daira, Direction } = require("../../db");
const { audit } = require("../../services/audit");
const { generateCredentialsPdf } = require("../../services/credentialsPdfService");
const { revokeAllForUser } = require("../auth/refreshTokenService");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
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
  return { dairas: rows, total: count, page, pageSize };
}

async function createDaira(data, actor, req) {
  const row = await Daira.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code: data.code
  });
  await audit(actor.id, "DAIRA_CREATE", { daira_id: row.id, code: row.code }, { req });
  return row;
}

async function updateDaira(id, data, actor, req) {
  const row = await Daira.findByPk(id);
  if (!row) notFound();
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {})
  });
  await audit(actor.id, "DAIRA_UPDATE", { daira_id: row.id }, { req });
  return row;
}

async function hideDaira(id, actor, req) {
  const row = await Daira.findByPk(id);
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
  return row;
}

async function restoreDaira(id, actor, req) {
  const row = await Daira.findByPk(id);
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
  return row;
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
  return { directions: rows, total: count, page, pageSize };
}

async function createDirection(data, actor, req) {
  const code = String(data.code || "").trim() || (await nextDirectionCode());
  const row = await Direction.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code
  });
  await audit(actor.id, "DIRECTION_CREATE", { direction_id: row.id, code: row.code }, { req });
  return row;
}

async function updateDirection(id, data, actor, req) {
  const row = await Direction.findByPk(id);
  if (!row) notFound();
  await row.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {})
  });
  await audit(actor.id, "DIRECTION_UPDATE", { direction_id: row.id }, { req });
  return row;
}

async function hideDirection(id, actor, req) {
  const row = await Direction.findByPk(id);
  if (!row) notFound();
  if (row.hidden_at) alreadyHidden();
  await row.update({ hidden_at: new Date() });
  await audit(actor.id, "DIRECTION_HIDE", { direction_id: row.id }, { req });
  return row;
}

async function restoreDirection(id, actor, req) {
  const row = await Direction.findByPk(id);
  if (!row) notFound();
  if (!row.hidden_at) notHidden();
  await row.update({ hidden_at: null });
  await audit(actor.id, "DIRECTION_RESTORE", { direction_id: row.id }, { req });
  return row;
}

async function listMunicipalities(query) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = applyHiddenScope(refSearchWhere(query.q), query);
  if (query.daira_id) where.daira_id = query.daira_id;
  const { rows, count } = await Municipality.findAndCountAll({
    where,
    order: [["code", "ASC"]],
    offset,
    limit,
    include: [{ association: "daira", attributes: ["id", "code", "name_ar", "name_fr"] }]
  });
  return { municipalities: rows, total: count, page, pageSize };
}

async function createMunicipality(data, actor, req) {
  const muni = await Municipality.create({
    name_ar: data.name_ar,
    name_fr: data.name_fr,
    code: data.code,
    daira_id: data.daira_id
  });
  await audit(actor.id, "MUNICIPALITY_CREATE", { municipality_id: muni.id, code: muni.code }, { req });
  return muni;
}

async function updateMunicipality(id, data, actor, req) {
  const muni = await Municipality.findByPk(id);
  if (!muni) notFound();
  await muni.update({
    ...(data.name_ar != null ? { name_ar: data.name_ar } : {}),
    ...(data.name_fr != null ? { name_fr: data.name_fr } : {}),
    ...(data.code != null ? { code: data.code } : {}),
    ...(data.daira_id != null ? { daira_id: data.daira_id } : {})
  });
  await audit(actor.id, "MUNICIPALITY_UPDATE", { municipality_id: muni.id }, { req });
  return muni;
}

async function hideMunicipality(id, actor, req) {
  const muni = await Municipality.findByPk(id);
  if (!muni) notFound();
  if (muni.hidden_at) alreadyHidden();
  await muni.update({ hidden_at: new Date() });
  await audit(actor.id, "MUNICIPALITY_HIDE", { municipality_id: muni.id }, { req });
  return muni;
}

async function restoreMunicipality(id, actor, req) {
  const muni = await Municipality.findByPk(id);
  if (!muni) notFound();
  if (!muni.hidden_at) notHidden();
  await muni.update({ hidden_at: null });
  await audit(actor.id, "MUNICIPALITY_RESTORE", { municipality_id: muni.id }, { req });
  return muni;
}

function userSearchWhere(q, role) {
  const where = {};
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
    include: [{ association: "department", attributes: ["id", "name_ar", "name_fr"] }]
  });
  return { users: rows, total: count, page, pageSize };
}

function randomPassword8() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

async function createUser(data, actor, req) {
  const existing = await User.findOne({ where: { username: data.username } });
  if (existing) {
    const err = new Error("errorUsernameExists");
    err.status = 409;
    throw err;
  }
  const initialPassword = randomPassword8();
  const user = await User.create({
    username: data.username,
    name: data.name,
    role: data.role,
    department_id: data.department_id ?? null,
    job_title: data.job_title ?? null,
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
    { user_id: user.id, role: user.role, pdf_url: pdf.file_url },
    { req }
  );
  return {
    user,
    initialPassword,
    credentials: { code8: initialPassword, pdf_url: pdf.file_url }
  };
}

async function updateUser(id, data, actor, req) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await user.update({
    ...(data.name != null ? { name: data.name } : {}),
    ...(data.department_id !== undefined ? { department_id: data.department_id } : {}),
    ...(data.job_title !== undefined ? { job_title: data.job_title } : {})
  });
  await audit(actor.id, "USER_UPDATE", { user_id: user.id }, { req });
  return user;
}

async function toggleBlockUser(id, actor, req) {
  const user = await User.findByPk(id);
  if (!user) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (Number(user.id) === Number(actor.id)) {
    const err = new Error("Cannot block self");
    err.status = 400;
    throw err;
  }
  await user.update({ is_blocked: !user.is_blocked });
  if (user.is_blocked) {
    await revokeAllForUser(user.id);
  }
  await audit(actor.id, "USER_BLOCK", { user_id: user.id, is_blocked: user.is_blocked }, { req });
  return user;
}

async function resetUserPassword(id, actor, req) {
  const user = await User.scope("withPassword").findByPk(id);
  if (!user) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
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
  resetUserPassword
};
