"use strict";

/** Office delete requests awaiting Chef approval. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("rapports", "delete_requested_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("rapports", "delete_requested_by_user_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addIndex("rapports", ["delete_requested_at"], {
      name: "idx_rapports_delete_requested_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "rapports",
      "idx_rapports_delete_requested_at",
    );
    await queryInterface.removeColumn(
      "rapports",
      "delete_requested_by_user_id",
    );
    await queryInterface.removeColumn("rapports", "delete_requested_at");
  },
};
