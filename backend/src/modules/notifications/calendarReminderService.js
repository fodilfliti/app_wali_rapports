const { Op } = require("sequelize");
const {
  RapportCalendarEvent,
  Rapport,
  User,
} = require("../../db");
const { notifyUsers, notifyActiveRole } = require("./notifyService");

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

function pushOverridesForEvent(event, kind) {
  const title = event.title_ar || event.title_fr || "";
  return {
    body_ar: title ? `${title}` : undefined,
    body_fr: title ? `${event.title_fr || event.title_ar || title}` : undefined,
    url: kind === "chef" ? "/chef/calendar" : "/wali/calendar",
    tag: `calendar-${event.id}-${event.event_date}`,
  };
}

async function fanoutEventReminders(events, { today, tomorrow } = {}) {
  const t = today || algiersDateOnly();
  const tm = tomorrow || addDaysAlgiers(t, 1);
  const list = (events || []).filter(Boolean);
  if (!list.length) return;

  for (const event of list) {
    const date = String(event.event_date || "").slice(0, 10);
    let message_key = null;
    if (date === t) message_key = "calendarToday";
    else if (date === tm) message_key = "calendarTomorrow";
    if (!message_key) continue;

    const rapport = event.rapport || (await Rapport.findByPk(event.rapport_id));
    if (!rapport || rapport.hidden_at) continue;
    const status = rapport.status;

    const baseOpts = {
      message_key,
      rapport_id: Number(event.rapport_id),
      calendar_event_id: Number(event.id),
      dedupeCalendar: true,
    };

    // Wali: exclude draft, pending_chef, archived
    if (!["draft", "pending_chef", "archived"].includes(status)) {
      await notifyActiveRole("WALI", {
        ...baseOpts,
        push: pushOverridesForEvent(event, "wali"),
      });
    }
    // Chef: exclude draft, archived (pending_chef visible)
    if (!["draft", "archived"].includes(status)) {
      await notifyActiveRole("CHEF_CABINET", {
        ...baseOpts,
        push: pushOverridesForEvent(event, "chef"),
      });
    }
  }
}

/** After calendar replace-save: remind for today/tomorrow events. */
async function remindAfterCalendarSave(rapportId, savedEvents) {
  if (!savedEvents?.length) return;
  const rapport = await Rapport.findByPk(rapportId);
  if (!rapport) return;
  const today = algiersDateOnly();
  const tomorrow = addDaysAlgiers(today, 1);
  const relevant = savedEvents.filter((e) => {
    const d = String(e.event_date || "").slice(0, 10);
    return d === today || d === tomorrow;
  });
  if (!relevant.length) return;
  await fanoutEventReminders(
    relevant.map((e) => ({ ...e, rapport })),
    { today, tomorrow },
  );
}

/**
 * Once per user per local day: scan today+tomorrow and create missing reminders.
 * @param {{ id: number, role: string, calendar_reminders_checked_on?: string|null }} user
 */
async function maybeRunDailyCalendarScan(user) {
  if (!user || !["WALI", "CHEF_CABINET"].includes(user.role)) return;
  const today = algiersDateOnly();
  const checked = user.calendar_reminders_checked_on
    ? String(user.calendar_reminders_checked_on).slice(0, 10)
    : null;
  if (checked === today) return;

  const tomorrow = addDaysAlgiers(today, 1);
  const forChef = user.role === "CHEF_CABINET";
  const hiddenStatuses = forChef
    ? ["draft", "archived"]
    : ["draft", "pending_chef", "archived"];

  const rows = await RapportCalendarEvent.findAll({
    where: { event_date: { [Op.in]: [today, tomorrow] } },
    include: [
      {
        model: Rapport,
        as: "rapport",
        required: true,
        attributes: ["id", "status", "hidden_at"],
        where: {
          status: { [Op.notIn]: hiddenStatuses },
          hidden_at: null,
        },
      },
    ],
  });

  for (const row of rows) {
    const event = row.toJSON ? row.toJSON() : row;
    const date = String(event.event_date || "").slice(0, 10);
    const message_key = date === today ? "calendarToday" : "calendarTomorrow";
    await notifyUsers({
      userIds: [Number(user.id)],
      message_key,
      rapport_id: Number(event.rapport_id),
      calendar_event_id: Number(event.id),
      dedupeCalendar: true,
      push: pushOverridesForEvent(event, forChef ? "chef" : "wali"),
    });
  }

  await User.update(
    { calendar_reminders_checked_on: today },
    { where: { id: user.id } },
  );
  user.calendar_reminders_checked_on = today;
}

module.exports = {
  algiersDateOnly,
  addDaysAlgiers,
  remindAfterCalendarSave,
  maybeRunDailyCalendarScan,
  fanoutEventReminders,
};
