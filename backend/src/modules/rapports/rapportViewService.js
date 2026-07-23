const { RapportView, User, Rapport } = require("../../db");
const { findByPublicId, isUuid } = require("../access/idResolver");

async function resolveNumericRapportIdLocal(id) {
  if (id == null) return null;
  if (isUuid(String(id))) {
    const row = await findByPublicId(Rapport, id, { attributes: ["id"] });
    return row?.id ?? null;
  }
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function recordView(rapportId, user) {
  if (!user?.id) return null;
  const numericRapportId = await resolveNumericRapportIdLocal(rapportId);
  if (numericRapportId == null) return null;
  const numericUserId = Number(user.id);
  if (!Number.isFinite(numericUserId)) return null;
  const [row] = await RapportView.findOrCreate({
    where: { rapport_id: numericRapportId, user_id: numericUserId },
    defaults: { viewed_at: new Date() }
  });
  if (row && !row.viewed_at) {
    await row.update({ viewed_at: new Date() });
  }
  return row;
}

async function listViewsForRapport(rapportId) {
  const numericRapportId = await resolveNumericRapportIdLocal(rapportId);
  if (numericRapportId == null) return [];
  const rows = await RapportView.findAll({
    where: { rapport_id: numericRapportId },
    order: [["viewed_at", "DESC"]],
    include: [{ model: User, as: "user", attributes: ["id", "uuid", "name", "username", "role"] }]
  });
  return rows.map((r) => {
    const j = r.toJSON();
    return {
      user: j.user,
      viewed_at: j.viewed_at
    };
  });
}

module.exports = { recordView, listViewsForRapport };
