"use strict";

/**
 * Upsert the env-bootstrapped super-admin account.
 * Prefers SUPER_ADMIN_* when set; otherwise uses DEV_ADMIN_*.
 * Never clears is_super_admin on other users; only marks this username.
 */

const bcrypt = require("bcryptjs");
const { User } = require("../../src/db");

async function ensureSuperAdminFromEnv({ resetPassword = false } = {}) {
  const username = String(
    process.env.SUPER_ADMIN_USERNAME || process.env.DEV_ADMIN_USERNAME || ""
  ).trim();
  const password = String(
    process.env.SUPER_ADMIN_PASSWORD || process.env.DEV_ADMIN_PASSWORD || ""
  );
  if (!username || !password) {
    return {
      skipped: true,
      reason: "SUPER_ADMIN_* or DEV_ADMIN_USERNAME/PASSWORD not set",
    };
  }

  const name =
    String(
      process.env.SUPER_ADMIN_NAME || process.env.DEV_ADMIN_NAME || ""
    ).trim() || "مسؤول أعلى";
  const emailRaw = String(
    process.env.SUPER_ADMIN_EMAIL || process.env.DEV_ADMIN_EMAIL || ""
  ).trim();
  const email = emailRaw || null;

  let user = await User.scope("withPassword").findOne({ where: { username } });
  if (!user) {
    user = await User.create({
      username,
      name,
      email,
      role: "ADMIN",
      is_super_admin: true,
      is_blocked: false,
      deleted_at: null,
      password_hash: await bcrypt.hash(password, 10),
    });
    return { created: true, userId: user.id, username };
  }

  const patch = {
    role: "ADMIN",
    is_super_admin: true,
    is_blocked: false,
    deleted_at: null,
  };
  if (name) patch.name = name;
  if (email != null) patch.email = email;
  if (resetPassword) {
    patch.password_hash = await bcrypt.hash(password, 10);
  }
  await user.update(patch);
  return { updated: true, userId: user.id, username, passwordReset: resetPassword };
}

module.exports = { ensureSuperAdminFromEnv };
