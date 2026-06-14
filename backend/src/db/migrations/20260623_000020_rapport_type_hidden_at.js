"use strict";

/** Soft-hide rapport types from office service hub (not deletable types like fiche_lecture). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("rapport_types", "hidden_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex("rapport_types", ["hidden_at"], {
      name: "idx_rapport_types_hidden_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("rapport_types", "idx_rapport_types_hidden_at");
    await queryInterface.removeColumn("rapport_types", "hidden_at");
  },
};
