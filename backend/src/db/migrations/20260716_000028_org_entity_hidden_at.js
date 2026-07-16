"use strict";

/** Soft-hide org reference rows (dairas, communes, directions) — kept in DB for old rapports. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of ["dairas", "municipalities", "directions"]) {
      await queryInterface.addColumn(table, "hidden_at", {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await queryInterface.addIndex(table, ["hidden_at"], {
        name: `idx_${table}_hidden_at`,
      });
    }
  },

  async down(queryInterface) {
    for (const table of ["dairas", "municipalities", "directions"]) {
      await queryInterface.removeIndex(table, `idx_${table}_hidden_at`);
      await queryInterface.removeColumn(table, "hidden_at");
    }
  },
};
