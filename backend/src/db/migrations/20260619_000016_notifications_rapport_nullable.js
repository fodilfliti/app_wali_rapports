"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE notifications
      ALTER COLUMN rapport_id DROP NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("notifications", "rapport_id", {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: { model: "rapports", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  }
};
