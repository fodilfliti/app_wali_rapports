const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { RefreshToken, User, sequelize } = require("../../db");
const { getEnv } = require("../../config/env");
const { audit } = require("../../services/audit");
const { enrichSessionUser } = require("../access/userProfileService");

const REFRESH_COOKIE_NAME = "wr_refresh";

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function clientMeta(req) {
  const ip =
    (req.headers?.["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : null) ||
    req.ip ||
    null;
  const ua = req.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 512) : null;
  return { ip, user_agent: ua };
}

function refreshCookiePath() {
  const base = getEnv().apiBasePath || "";
  return `${base}/auth`;
}

function cookieOptions(maxAgeMs) {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: Boolean(env.cookieSecure),
    sameSite: "lax",
    path: refreshCookiePath(),
    maxAge: maxAgeMs,
  };
}

function setRefreshCookie(res, rawToken, maxAgeMs) {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, cookieOptions(maxAgeMs));
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: Boolean(getEnv().cookieSecure),
    sameSite: "lax",
    path: refreshCookiePath(),
  });
}

function signAccessToken(user) {
  const env = getEnv();
  return jwt.sign(
    { sub: String(user.id), role: user.role, typ: "access" },
    env.jwtSecret,
    { expiresIn: env.jwtAccessExpiresIn, algorithm: "HS256" }
  );
}

function readRefreshRaw(req) {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  return raw && typeof raw === "string" && raw.length > 0 ? raw : null;
}

async function createRefreshRow(userId, familyId, familyExpiresAt, req, transaction) {
  const raw = generateRawToken();
  const meta = clientMeta(req);
  const row = await RefreshToken.create(
    {
      user_id: userId,
      token_hash: hashToken(raw),
      family_id: familyId,
      family_expires_at: familyExpiresAt,
      expires_at: familyExpiresAt,
      revoked_at: null,
      replaced_by_id: null,
      user_agent: meta.user_agent,
      ip: meta.ip,
      created_at: new Date(),
    },
    { transaction }
  );
  return { raw, row };
}

/**
 * Issue access JWT + new refresh family cookie after successful login.
 */
async function issueSession(user, req, res) {
  const env = getEnv();
  const familyId = crypto.randomUUID();
  const familyExpiresAt = new Date(Date.now() + env.refreshTokenExpiresMs);
  const { raw, row } = await createRefreshRow(user.id, familyId, familyExpiresAt, req);
  const maxAgeMs = Math.max(0, familyExpiresAt.getTime() - Date.now());
  setRefreshCookie(res, raw, maxAgeMs);
  const token = signAccessToken(user);
  const sessionUser = await enrichSessionUser(user);
  return { token, user: sessionUser, familyId: row.family_id };
}

async function revokeFamily(familyId, transaction) {
  await RefreshToken.update(
    { revoked_at: new Date() },
    {
      where: {
        family_id: familyId,
        revoked_at: null,
      },
      transaction,
    }
  );
}

async function revokeAllForUser(userId, transaction) {
  await RefreshToken.update(
    { revoked_at: new Date() },
    {
      where: {
        user_id: userId,
        revoked_at: null,
      },
      transaction,
    }
  );
}

/**
 * Rotate refresh cookie → new access token (+ optional enriched user).
 * Throws errors with .status for route handling.
 */
async function rotateRefresh(req, res) {
  const raw = readRefreshRaw(req);
  if (!raw) {
    const err = new Error("Invalid token");
    err.status = 401;
    throw err;
  }

  const tokenHash = hashToken(raw);
  const now = new Date();

  return sequelize.transaction(async (transaction) => {
    const existing = await RefreshToken.findOne({
      where: { token_hash: tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existing) {
      clearRefreshCookie(res);
      const err = new Error("Invalid token");
      err.status = 401;
      throw err;
    }

    if (existing.expires_at <= now || existing.family_expires_at <= now) {
      if (!existing.revoked_at) {
        await existing.update({ revoked_at: now }, { transaction });
      }
      clearRefreshCookie(res);
      const err = new Error("Invalid token");
      err.status = 401;
      throw err;
    }

    const user = await User.findByPk(existing.user_id, { transaction });
    if (!user || user.is_blocked) {
      await revokeFamily(existing.family_id, transaction);
      clearRefreshCookie(res);
      const err = new Error("Invalid token");
      err.status = 401;
      throw err;
    }

    // Concurrent multi-tab reuse of a just-rotated token: return access only.
    if (existing.revoked_at || existing.replaced_by_id) {
      const graceMs = getEnv().refreshReuseGraceMs;
      const rotatedAt = existing.revoked_at ? new Date(existing.revoked_at).getTime() : 0;
      const withinGrace =
        Boolean(existing.replaced_by_id) &&
        rotatedAt > 0 &&
        now.getTime() - rotatedAt <= graceMs;

      if (withinGrace) {
        const token = signAccessToken(user);
        const sessionUser = await enrichSessionUser(user);
        await audit(
          user.id,
          "TOKEN_REFRESH",
          { family_id: existing.family_id, concurrent_reuse: true },
          { req }
        );
        return { token, user: sessionUser };
      }

      await revokeFamily(existing.family_id, transaction);
      clearRefreshCookie(res);
      await audit(existing.user_id, "TOKEN_REUSE_DETECTED", { family_id: existing.family_id }, { req });
      const err = new Error("Invalid token");
      err.status = 401;
      throw err;
    }

    const { raw: nextRaw, row: nextRow } = await createRefreshRow(
      user.id,
      existing.family_id,
      existing.family_expires_at,
      req,
      transaction
    );

    await existing.update(
      { revoked_at: now, replaced_by_id: nextRow.id },
      { transaction }
    );

    const maxAgeMs = Math.max(0, existing.family_expires_at.getTime() - Date.now());
    setRefreshCookie(res, nextRaw, maxAgeMs);

    const token = signAccessToken(user);
    const sessionUser = await enrichSessionUser(user);
    await audit(user.id, "TOKEN_REFRESH", { family_id: existing.family_id }, { req });
    return { token, user: sessionUser };
  });
}

/**
 * Logout: revoke family for cookie and/or clear cookie.
 * Optional access JWT user id used when cookie missing.
 */
async function logoutSession(req, res) {
  const raw = readRefreshRaw(req);
  let familyId = null;
  let userId = req.user?.id || null;

  if (raw) {
    const existing = await RefreshToken.findOne({ where: { token_hash: hashToken(raw) } });
    if (existing) {
      familyId = existing.family_id;
      userId = existing.user_id;
      await revokeFamily(existing.family_id);
    }
  }

  clearRefreshCookie(res);
  if (userId) {
    await audit(userId, "LOGOUT", { family_id: familyId }, { req });
  }
  return { success: true };
}

module.exports = {
  REFRESH_COOKIE_NAME,
  issueSession,
  rotateRefresh,
  logoutSession,
  revokeAllForUser,
  revokeFamily,
  clearRefreshCookie,
  readRefreshRaw,
  signAccessToken,
};
