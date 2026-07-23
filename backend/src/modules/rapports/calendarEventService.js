const { Op } = require("sequelize");
const { RapportCalendarEvent, Rapport, Service, RapportType } = require("../../db");
const { findByPublicId } = require("../access/idResolver");
const { assertRapportAccess } = require("./serviceAccessService");
const { resolveNumericRapportId } = require("./rapportService");
const { remindAfterCalendarSave } = require("../notifications/calendarReminderService");

function parseDateOnly(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  return String(s);
}

function serializeEvent(row) {
  const e = row.toJSON ? row.toJSON() : row;
  return {
    id: e.id,
    rapport_id: e.rapport_id,
    event_date: e.event_date,
    title_ar: e.title_ar,
    title_fr: e.title_fr,
    note_ar: e.note_ar,
    note_fr: e.note_fr
  };
}

async function listForRapport(rapportId, actor) {
  if (
    actor?.role !== "WALI" &&
    actor?.role !== "CHEF_CABINET" &&
    actor?.role !== "ADMIN"
  ) {
    await assertRapportAccess(actor, rapportId, "view");
  }
  const numericRapportId = await resolveNumericRapportId(rapportId);
  if (!numericRapportId) return [];
  const rows = await RapportCalendarEvent.findAll({
    where: { rapport_id: numericRapportId },
    order: [["event_date", "ASC"], ["id", "ASC"]]
  });
  return rows.map(serializeEvent);
}

async function replaceForRapport(rapportId, events, actor) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await findByPublicId(Rapport, rapportId);
  if (!rapport || !["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }
  const numericRapportId = rapport.id;

  const existing = await RapportCalendarEvent.findAll({
    where: { rapport_id: numericRapportId },
  });
  const existingById = new Map(existing.map((e) => [Number(e.id), e]));
  const keepIds = new Set();

  const normalized = (events || []).map((e) => {
    const date = parseDateOnly(e.event_date);
    if (!date) {
      const err = new Error("Invalid event date");
      err.status = 400;
      throw err;
    }
    return {
      id: e.id != null ? Number(e.id) : null,
      rapport_id: numericRapportId,
      event_date: date,
      title_ar: String(e.title_ar || "").slice(0, 200),
      title_fr: String(e.title_fr || "").slice(0, 200),
      note_ar: e.note_ar || null,
      note_fr: e.note_fr || null,
      created_by_user_id: actor.id,
      updated_at: new Date()
    };
  });

  for (const item of normalized) {
    if (item.id && existingById.has(item.id)) {
      const row = existingById.get(item.id);
      await row.update({
        event_date: item.event_date,
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        note_ar: item.note_ar,
        note_fr: item.note_fr,
        updated_at: item.updated_at,
      });
      keepIds.add(item.id);
    } else {
      const created = await RapportCalendarEvent.create({
        rapport_id: item.rapport_id,
        event_date: item.event_date,
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        note_ar: item.note_ar,
        note_fr: item.note_fr,
        created_by_user_id: item.created_by_user_id,
        updated_at: item.updated_at,
      });
      keepIds.add(Number(created.id));
    }
  }

  const toDelete = existing
    .map((e) => Number(e.id))
    .filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    await RapportCalendarEvent.destroy({ where: { id: { [Op.in]: toDelete } } });
  }

  const saved = await listForRapport(rapportId, actor);
  await remindAfterCalendarSave(rapportId, saved);
  return saved;
}

function weekBounds(anchorDate) {
  const d = anchorDate ? new Date(`${anchorDate}T12:00:00`) : new Date();
  const day = d.getDay();
  // Week starts Saturday (common in Algeria / ar-DZ)
  const diff = -((day + 1) % 7);
  const saturday = new Date(d);
  saturday.setDate(d.getDate() + diff);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  const fmt = (x) => x.toISOString().slice(0, 10);
  return { from: fmt(saturday), to: fmt(friday) };
}

async function listForWaliCalendar(query, opts = {}) {
  let from = parseDateOnly(query.from);
  let to = parseDateOnly(query.to);
  if (!from || !to) {
    const w = weekBounds(query.week);
    from = w.from;
    to = w.to;
  }

  const hiddenStatuses = opts.forChef
    ? ["draft", "archived"]
    : ["draft", "pending_chef", "archived"];

  const rows = await RapportCalendarEvent.findAll({
    where: { event_date: { [Op.between]: [from, to] } },
    order: [["event_date", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: Rapport,
        as: "rapport",
        required: true,
        attributes: ["id", "title", "status"],
        where: {
          status: {
            [Op.notIn]: hiddenStatuses,
          },
          hidden_at: null,
        },
        include: [
          { model: Service, as: "service", attributes: ["id", "name_ar", "name_fr"] },
          { model: RapportType, as: "rapportType", attributes: ["id", "content_kind"] }
        ]
      }
    ]
  });

  return {
    from,
    to,
    events: rows.map((row) => {
      const e = serializeEvent(row);
      const r = row.rapport?.toJSON?.() || row.rapport;
      return {
        ...e,
        rapport: r
          ? {
              id: r.id,
              title: r.title,
              status: r.status,
              service: r.service,
              content_kind: r.rapportType?.content_kind
            }
          : null
      };
    })
  };
}

module.exports = { listForRapport, replaceForRapport, listForWaliCalendar, weekBounds };
