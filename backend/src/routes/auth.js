const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { User } = require("../db");
const { audit } = require("../services/audit");
const { enrichSessionUser } = require("../modules/access/userProfileService");
const {
  issueSession,
  rotateRefresh,
  logoutSession,
  revokeAllForUser,
  clearRefreshCookie,
} = require("../modules/auth/refreshTokenService");
const { requireAuth, attachUser, checkBlocked } = require("../middleware/auth");
const { validateBody } = require("../middleware/validateBody");
const {
  changeCodeSchema,
  profilePatchSchema,
  notificationPrefsSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} = require("../validation/schemas/auth");
const { getEnv } = require("../config/env");
const {
  getPreferences,
  upsertPreferences,
} = require("../modules/notifications/preferenceService");
const {
  getVapidPublicKey,
  upsertSubscription,
  removeSubscription,
} = require("../modules/notifications/pushService");

const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
  skipSuccessfulRequests: true,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many refresh attempts" },
});

/** Best-effort attach of req.user from Bearer access JWT (logout may be cookie-only). */
function tryAttachAccessUser(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, getEnv().jwtSecret, { algorithms: ["HS256"] });
    if (payload?.sub && (!payload.typ || payload.typ === "access")) {
      req.auth = payload;
      return User.findByPk(payload.sub)
        .then((user) => {
          if (user) req.user = user;
          next();
        })
        .catch(() => next());
    }
  } catch {
    /* ignore — cookie logout still works */
  }
  return next();
}

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });

    const user = await User.scope("withPassword").findOne({ where: { username } });
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    const blocked = Boolean(user?.is_blocked) || Boolean(user?.deleted_at);

    await audit(user?.id, "LOGIN_ATTEMPT", { username, success: ok && !blocked, blocked }, { req });

    if (!user || !ok || blocked) return res.status(401).json({ error: "Invalid credentials" });

    const { token, user: sessionUser } = await issueSession(user, req, res);
    res.json({ token, user: sessionUser });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const result = await rotateRefresh(req, res);
    res.json(result);
  } catch (e) {
    if (e.status === 401) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: e.message || "Invalid token" });
    }
    next(e);
  }
});

authRouter.post("/logout", tryAttachAccessUser, async (req, res, next) => {
  try {
    const result = await logoutSession(req, res);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAuth, attachUser, checkBlocked, async (req, res, next) => {
  try {
    const sessionUser = await enrichSessionUser(req.user);
    res.json({ user: sessionUser });
  } catch (e) {
    next(e);
  }
});

authRouter.patch(
  "/me",
  requireAuth,
  attachUser,
  checkBlocked,
  validateBody(profilePatchSchema),
  async (req, res, next) => {
    try {
      const { name, job_title } = req.validatedBody;
      const patch = { name };
      if (job_title !== undefined) {
        patch.job_title = job_title === null || job_title === "" ? null : job_title;
      }
      await req.user.update(patch);
      await audit(
        req.user.id,
        "USER_SELF_UPDATE",
        { user_id: req.user.id, fields: Object.keys(patch) },
        { req },
      );
      const sessionUser = await enrichSessionUser(req.user);
      res.json({ user: sessionUser });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  "/change-password",
  requireAuth,
  attachUser,
  checkBlocked,
  validateBody(changeCodeSchema),
  async (req, res, next) => {
    try {
      const { current_code, new_code } = req.validatedBody;
      const userWithSecret = await User.scope("withPassword").findByPk(req.user.id);
      if (!userWithSecret) return res.status(401).json({ error: "Unauthorized" });

      const currentOk = await bcrypt.compare(String(current_code), userWithSecret.password_hash);
      if (!currentOk) {
        await audit(req.user.id, "SELF_PASSWORD_CHANGE_FAILED", { reason: "INVALID_CURRENT" }, { req });
        return res.status(400).json({ error: "errorCurrentCodeIncorrect" });
      }

      const password_hash = await bcrypt.hash(String(new_code).trim(), 10);
      await userWithSecret.update({ password_hash });
      await revokeAllForUser(req.user.id);
      clearRefreshCookie(res);
      await audit(req.user.id, "SELF_PASSWORD_CHANGE", { user_id: req.user.id }, { req });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
);

authRouter.get(
  "/me/notification-preferences",
  requireAuth,
  attachUser,
  checkBlocked,
  async (req, res, next) => {
    try {
      res.json({ preferences: await getPreferences(req.user.id) });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.put(
  "/me/notification-preferences",
  requireAuth,
  attachUser,
  checkBlocked,
  validateBody(notificationPrefsSchema),
  async (req, res, next) => {
    try {
      const preferences = await upsertPreferences(req.user.id, req.validatedBody);
      await audit(
        req.user.id,
        "NOTIFICATION_PREFS_UPDATE",
        { user_id: req.user.id, fields: Object.keys(req.validatedBody) },
        { req },
      );
      res.json({ preferences });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.get(
  "/push/vapid-public-key",
  requireAuth,
  attachUser,
  checkBlocked,
  async (req, res, next) => {
    try {
      const key = getVapidPublicKey();
      if (!key) return res.status(503).json({ error: "pushNotConfigured" });
      res.json({ publicKey: key });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.post(
  "/push/subscribe",
  requireAuth,
  attachUser,
  checkBlocked,
  validateBody(pushSubscribeSchema),
  async (req, res, next) => {
    try {
      if (req.user.role === "ADMIN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      const sub = await upsertSubscription(
        req.user.id,
        req.validatedBody,
        req.headers["user-agent"],
      );
      await audit(
        req.user.id,
        "PUSH_SUBSCRIBE",
        { subscription_id: sub.id },
        { req },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

authRouter.delete(
  "/push/subscribe",
  requireAuth,
  attachUser,
  checkBlocked,
  validateBody(pushUnsubscribeSchema),
  async (req, res, next) => {
    try {
      await removeSubscription(req.user.id, req.validatedBody.endpoint);
      await audit(
        req.user.id,
        "PUSH_UNSUBSCRIBE",
        { endpoint: String(req.validatedBody.endpoint).slice(0, 120) },
        { req },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

module.exports = { authRouter };
