const { UserNotificationPreference } = require("../../db");
const { PREF_DEFAULTS } = require("../rapports/notificationKeys");

function serializePrefs(row) {
  if (!row) return { ...PREF_DEFAULTS };
  return {
    enabled: row.enabled !== false,
    push_enabled: row.push_enabled !== false,
    rapport_inbox: row.rapport_inbox !== false,
    rapport_feedback: row.rapport_feedback !== false,
    discussion: row.discussion !== false,
    instructions: row.instructions !== false,
    chef_instructions: row.chef_instructions !== false,
    broadcasts: row.broadcasts !== false,
    calendar: row.calendar !== false,
  };
}

async function getPreferences(userId) {
  const row = await UserNotificationPreference.findByPk(userId);
  return serializePrefs(row);
}

async function getPreferencesMap(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await UserNotificationPreference.findAll({
    where: { user_id: ids },
  });
  const map = new Map();
  for (const id of ids) map.set(id, { ...PREF_DEFAULTS });
  for (const row of rows) {
    map.set(Number(row.user_id), serializePrefs(row));
  }
  return map;
}

async function upsertPreferences(userId, patch) {
  const current = await getPreferences(userId);
  const next = {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch || {}).filter(([, v]) => typeof v === "boolean"),
    ),
  };
  const [row] = await UserNotificationPreference.upsert({
    user_id: userId,
    ...next,
    updated_at: new Date(),
  });
  return serializePrefs(row || next);
}

function isTypeAllowed(prefs, prefType) {
  if (!prefs?.enabled) return false;
  return prefs[prefType] !== false;
}

module.exports = {
  getPreferences,
  getPreferencesMap,
  upsertPreferences,
  serializePrefs,
  isTypeAllowed,
};
