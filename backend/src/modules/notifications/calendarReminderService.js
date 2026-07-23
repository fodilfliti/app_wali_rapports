const { Op } = require("sequelize");
const {
  RapportCalendarEvent,
  Rapport,
  User,
  Notification,
} = require("../../db");
const { notifyUsers, notifyActiveRole } = require("./notifyService");

const TITLE_CAP = 5;

/** YYYY-MM-DD in Africa/Algiers. */
function algiersDateOnly(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysAlgiers(dateOnly, days) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return algiersDateOnly(utc);
}

function eventTitle(event, lang) {
  if (lang === "fr") return event.title_fr || event.title_ar || "";
  return event.title_ar || event.title_fr || "";
}

function formatTitleList(titles) {
  const clean = titles.map((t) => String(t || "").trim()).filter(Boolean);
  if (!clean.length) return "";
  const shown = clean.slice(0, TITLE_CAP);
  const extra = clean.length > TITLE_CAP ? `؛ +${clean.length - TITLE_CAP}` : "";
  return `${shown.join("؛ ")}${extra}`;
}

function buildDigestPush(events, messageKey, kind) {
  const n = events.length;
  const listAr = formatTitleList(events.map((e) => eventTitle(e, "ar")));
  const listFr = formatTitleList(events.map((e) => eventTitle(e, "fr")));
  const isToday = messageKey === "calendarToday";
  const url = kind === "chef" ? "/chief/calendar" : "/governor/calendar";

  const title_ar = isToday
    ? n === 1
      ? "حدث اليوم"
      : `أحداث اليوم (${n})`
    : n === 1
      ? "حدث غداً"
      : `أحداث غداً (${n})`;
  const title_fr = isToday
    ? n === 1
      ? "Événement aujourd'hui"
      : `Événements aujourd'hui (${n})`
    : n === 1
      ? "Événement demain"
      : `Événements demain (${n})`;

  const body_ar = isToday
    ? n === 1
      ? listAr || "لديك حدث في التقويم اليوم."
      : `لديك ${n} أحداث اليوم: ${listAr}`
    : n === 1
      ? listAr || "لديك حدث في التقويم غداً."
      : `لديك ${n} أحداث غداً: ${listAr}`;

  const body_fr = isToday
    ? n === 1
      ? listFr || "Vous avez un événement au calendrier aujourd'hui."
      : `Vous avez ${n} événements aujourd'hui : ${listFr}`
    : n === 1
      ? listFr || "Vous avez un événement au calendrier demain."
      : `Vous avez ${n} événements demain : ${listFr}`;

  return {
    title_ar,
    title_fr,
    body_ar,
    body_fr,
    url,
    tag: `calendar-digest-${isToday ? "today" : "tomorrow"}-${kind}`,
  };
}

function hiddenStatusesForRole(role) {
  if (role === "CHEF_CABINET") return ["draft", "archived"];
  return ["draft", "pending_chef", "archived"];
}

/**
 * Load all visible calendar events for a role on today + tomorrow.
 */
async function loadVisibleDayBuckets(role, today, tomorrow) {
  const rows = await RapportCalendarEvent.findAll({
    where: { event_date: { [Op.in]: [today, tomorrow] } },
    include: [
      {
        model: Rapport,
        as: "rapport",
        required: true,
        attributes: ["id", "status", "hidden_at"],
        where: {
          status: { [Op.notIn]: hiddenStatusesForRole(role) },
          hidden_at: null,
        },
      },
    ],
    order: [
      ["event_date", "ASC"],
      ["id", "ASC"],
    ],
  });

  const todayEvents = [];
  const tomorrowEvents = [];
  for (const row of rows) {
    const event = row.toJSON ? row.toJSON() : row;
    const date = String(event.event_date || "").slice(0, 10);
    if (date === today) todayEvents.push(event);
    else if (date === tomorrow) tomorrowEvents.push(event);
  }
  return { today: todayEvents, tomorrow: tomorrowEvents };
}

async function clearRoleDigest(role, messageKey) {
  const users = await User.findAll({
    where: { role, is_blocked: false, deleted_at: null },
    attributes: ["id"],
  });
  const ids = users.map((u) => Number(u.id));
  if (!ids.length) return;
  await Notification.destroy({
    where: {
      user_id: { [Op.in]: ids },
      message_key: messageKey,
    },
  });
}

async function sendRoleDayDigest(role, messageKey, events) {
  if (!events?.length) {
    await clearRoleDigest(role, messageKey);
    return;
  }
  const kind = role === "CHEF_CABINET" ? "chef" : "wali";
  await notifyActiveRole(role, {
    message_key: messageKey,
    calendar_event_id: null,
    rapport_id: null,
    dedupeCalendarDigest: true,
    push: buildDigestPush(events, messageKey, kind),
  });
}

async function sendUserDayDigest(userId, role, messageKey, events) {
  if (!events?.length) {
    await Notification.destroy({
      where: { user_id: Number(userId), message_key: messageKey },
    });
    return;
  }
  const kind = role === "CHEF_CABINET" ? "chef" : "wali";
  await notifyUsers({
    userIds: [Number(userId)],
    message_key: messageKey,
    calendar_event_id: null,
    rapport_id: null,
    dedupeCalendarDigest: true,
    push: buildDigestPush(events, messageKey, kind),
  });
}

/**
 * Rebuild full-day digests for Wali + Chef (same logic for both roles).
 * Used after calendar save so one rapport save does not emit a partial digest.
 */
async function rebuildAllRoleDigests({ today, tomorrow } = {}) {
  const t = today || algiersDateOnly();
  const tm = tomorrow || addDaysAlgiers(t, 1);

  for (const role of ["WALI", "CHEF_CABINET"]) {
    const buckets = await loadVisibleDayBuckets(role, t, tm);
    await sendRoleDayDigest(role, "calendarToday", buckets.today);
    await sendRoleDayDigest(role, "calendarTomorrow", buckets.tomorrow);
  }
}

/** After calendar replace-save: refresh digests from full day catalogue. */
async function remindAfterCalendarSave(_rapportId, _savedEvents) {
  await rebuildAllRoleDigests();
}

/**
 * Once per user per local day: scan today+tomorrow and create digest reminders.
 * Chef and Wali use the same digest shape (filters differ by role visibility only).
 */
async function maybeRunDailyCalendarScan(user) {
  if (!user || !["WALI", "CHEF_CABINET"].includes(user.role)) return;
  const today = algiersDateOnly();
  const checked = user.calendar_reminders_checked_on
    ? String(user.calendar_reminders_checked_on).slice(0, 10)
    : null;
  if (checked === today) return;

  const tomorrow = addDaysAlgiers(today, 1);
  const buckets = await loadVisibleDayBuckets(user.role, today, tomorrow);

  await sendUserDayDigest(user.id, user.role, "calendarToday", buckets.today);
  await sendUserDayDigest(user.id, user.role, "calendarTomorrow", buckets.tomorrow);

  await User.update(
    { calendar_reminders_checked_on: today },
    { where: { id: user.id } },
  );
  user.calendar_reminders_checked_on = today;
}

/** @deprecated alias — digests now always rebuild full days */
async function fanoutEventReminders(_events, opts = {}) {
  await rebuildAllRoleDigests(opts);
}

module.exports = {
  algiersDateOnly,
  addDaysAlgiers,
  remindAfterCalendarSave,
  maybeRunDailyCalendarScan,
  fanoutEventReminders,
  rebuildAllRoleDigests,
};
