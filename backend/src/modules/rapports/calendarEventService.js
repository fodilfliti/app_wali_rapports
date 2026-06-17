const { Op } = require("sequelize");
const { RapportCalendarEvent, Rapport, Service, RapportType } = require("../../db");
const { assertRapportAccess } = require("./serviceAccessService");

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
  if (actor?.role !== "WALI" && actor?.role !== "ADMIN") {
    await assertRapportAccess(actor, rapportId, "view");
  }
  const rows = await RapportCalendarEvent.findAll({
    where: { rapport_id: rapportId },
    order: [["event_date", "ASC"], ["id", "ASC"]]
  });
  return rows.map(serializeEvent);
}

async function replaceForRapport(rapportId, events, actor) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await Rapport.findByPk(rapportId);
  if (!rapport || !["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }

  const normalized = (events || []).map((e) => {
    const date = parseDateOnly(e.event_date);
    if (!date) {
      const err = new Error("Invalid event date");
      err.status = 400;
      throw err;
    }
    return {
      rapport_id: rapportId,
      event_date: date,
      title_ar: String(e.title_ar || "").slice(0, 200),
      title_fr: String(e.title_fr || "").slice(0, 200),
      note_ar: e.note_ar || null,
      note_fr: e.note_fr || null,
      created_by_user_id: actor.id,
      updated_at: new Date()
    };
  });

  await RapportCalendarEvent.destroy({ where: { rapport_id: rapportId } });
  if (normalized.length) {
    await RapportCalendarEvent.bulkCreate(normalized);
  }
  return listForRapport(rapportId, actor);
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

async function listForWaliCalendar(query) {
  let from = parseDateOnly(query.from);
  let to = parseDateOnly(query.to);
  if (!from || !to) {
    const w = weekBounds(query.week);
    from = w.from;
    to = w.to;
  }

  const rows = await RapportCalendarEvent.findAll({
    where: { event_date: { [Op.between]: [from, to] } },
    order: [["event_date", "ASC"], ["id", "ASC"]],
    include: [
      {
        model: Rapport,
        as: "rapport",
        attributes: ["id", "title", "status"],
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
