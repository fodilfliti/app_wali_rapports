"use strict";

const tlemcenMunicipalities = require("../seed-data/tlemcen-municipalities");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`SELECT COUNT(*)::int AS n FROM municipalities`);
    if (rows[0]?.n > 0) return;

    const now = new Date();
    await queryInterface.bulkInsert(
      "municipalities",
      tlemcenMunicipalities.map((m) => ({
        name_ar: m.name_ar,
        name_fr: m.name_fr,
        code: m.code,
        created_at: now
      }))
    );
  },

  async down(queryInterface) {
    const codes = tlemcenMunicipalities.map((m) => m.code);
    await queryInterface.bulkDelete("municipalities", { code: codes }, {});
  }
};
