"use strict";

/** Soft-hide finished rapports (kept in DB; admin purge later). */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("rapports", "hidden_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex("rapports", ["hidden_at"], {
      name: "idx_rapports_hidden_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("rapports", "idx_rapports_hidden_at");
    await queryInterface.removeColumn("rapports", "hidden_at");
  },
};
