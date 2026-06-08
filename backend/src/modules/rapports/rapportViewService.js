const { RapportView, User } = require("../../db");

async function recordView(rapportId, user) {
  if (!user?.id) return null;
  const [row] = await RapportView.findOrCreate({
    where: { rapport_id: rapportId, user_id: user.id },
    defaults: { viewed_at: new Date() }
  });
  if (row && !row.viewed_at) {
    await row.update({ viewed_at: new Date() });
  }
  return row;
}

async function listViewsForRapport(rapportId) {
  const rows = await RapportView.findAll({
    where: { rapport_id: rapportId },
    order: [["viewed_at", "DESC"]],
    include: [{ model: User, as: "user", attributes: ["id", "name", "username", "role"] }]
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
