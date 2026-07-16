const webpush = require("web-push");
const { WebPushSubscription, User } = require("../../db");
const { getEnv } = require("../../config/env");
const { getPreferencesMap } = require("./preferenceService");

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const env = getEnv();
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  vapidConfigured = true;
  return true;
}

function getVapidPublicKey() {
  const key = getEnv().vapidPublicKey;
  return key || null;
}

function deepLinkForRole(role, meta = {}) {
  const rapportId = meta.rapport_id;
  const key = meta.message_key;
  if (key === "calendarToday" || key === "calendarTomorrow") {
    return role === "CHEF_CABINET" ? "/chef/calendar" : "/wali/calendar";
  }
  if (key === "rapportPendingChef" || key === "rapportResubmittedBypass") {
    return rapportId ? `/chef/rapports/${rapportId}` : "/chef";
  }
  if (key === "rapportPendingWali") {
    return rapportId ? `/wali/rapports/${rapportId}` : "/wali";
  }
  if (key === "waliInstruction") {
    return meta.instruction_id
      ? `/office/instructions/${meta.instruction_id}`
      : "/office/instructions";
  }
  if (key === "waliBroadcast" || key === "waliBroadcastReminder") {
    if (role === "CHEF_CABINET") {
      return meta.broadcast_id ? `/chef/shared/${meta.broadcast_id}` : "/chef/shared";
    }
    return meta.broadcast_id ? `/office/shared/${meta.broadcast_id}` : "/office/shared";
  }
  if (rapportId) {
    if (role === "WALI") return `/wali/rapports/${rapportId}`;
    if (role === "CHEF_CABINET") return `/chef/rapports/${rapportId}`;
    return `/office/rapports/${rapportId}`;
  }
  return meta.url || "/";
}

async function upsertSubscription(userId, body, userAgent) {
  const endpoint = String(body?.endpoint || "").trim();
  const p256dh = String(body?.keys?.p256dh || "").trim();
  const auth = String(body?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }
  const existing = await WebPushSubscription.findOne({ where: { endpoint } });
  const now = new Date();
  if (existing) {
    await existing.update({
      user_id: userId,
      p256dh,
      auth,
      user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      last_seen_at: now,
    });
    return existing;
  }
  return WebPushSubscription.create({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
    created_at: now,
    last_seen_at: now,
  });
}

async function removeSubscription(userId, endpoint) {
  const ep = String(endpoint || "").trim();
  if (!ep) {
    const err = new Error("validationRequired");
    err.status = 400;
    throw err;
  }
  await WebPushSubscription.destroy({ where: { user_id: userId, endpoint: ep } });
  return { ok: true };
}

/**
 * Best-effort push to users who allow push. Never throws to callers.
 */
async function sendPushToUsers(userIds, payload, meta = {}) {
  if (!ensureVapid()) return;
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!ids.length || !payload?.title_ar) return;

  const [subs, users, prefsMap] = await Promise.all([
    WebPushSubscription.findAll({ where: { user_id: ids } }),
    User.findAll({ where: { id: ids }, attributes: ["id", "role"] }),
    getPreferencesMap(ids),
  ]);
  if (!subs.length) return;

  const roleById = new Map(users.map((u) => [Number(u.id), u.role]));

  await Promise.all(
    subs.map(async (sub) => {
      const prefs = prefsMap.get(Number(sub.user_id));
      if (!prefs?.enabled || !prefs?.push_enabled) return;
      const role = roleById.get(Number(sub.user_id));
      const url = deepLinkForRole(role, { ...meta, url: payload.url });
      const body = JSON.stringify({
        title_ar: payload.title_ar,
        title_fr: payload.title_fr || payload.title_ar,
        body_ar: payload.body_ar || "",
        body_fr: payload.body_fr || payload.body_ar || "",
        url,
        tag: payload.tag || "wali-rapports",
      });
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        await sub.update({ last_seen_at: new Date() });
      } catch (err) {
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) {
          await WebPushSubscription.destroy({ where: { id: sub.id } });
        }
      }
    }),
  );
}

module.exports = {
  getVapidPublicKey,
  upsertSubscription,
  removeSubscription,
  sendPushToUsers,
  ensureVapid,
  deepLinkForRole,
};
