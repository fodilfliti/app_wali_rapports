const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { User } = require("../db");
const { audit } = require("../services/audit");
const { enrichSessionUser } = require("../modules/access/userProfileService");
const { getEnv } = require("../config/env");

const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
  skipSuccessfulRequests: true
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password are required" });

    const user = await User.scope("withPassword").findOne({ where: { username } });
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    const blocked = Boolean(user?.is_blocked);

    await audit(user?.id, "LOGIN_ATTEMPT", { username, success: ok && !blocked, blocked }, { req });

    if (!user || !ok || blocked) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: String(user.id), role: user.role }, getEnv().jwtSecret, {
      expiresIn: "12h",
      algorithm: "HS256"
    });

    const sessionUser = await enrichSessionUser(user);
    res.json({ token, user: sessionUser });
  } catch (e) {
    next(e);
  }
});

const { requireAuth, attachUser, checkBlocked } = require("../middleware/auth");

authRouter.get("/me", requireAuth, attachUser, checkBlocked, async (req, res, next) => {
  try {
    const sessionUser = await enrichSessionUser(req.user);
    res.json({ user: sessionUser });
  } catch (e) {
    next(e);
  }
});

const { validateBody } = require("../middleware/validateBody");
const { changeCodeSchema } = require("../validation/schemas/auth");

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
      await audit(req.user.id, "SELF_PASSWORD_CHANGE", { user_id: req.user.id }, { req });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = { authRouter };
