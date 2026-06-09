"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("rapport_document_templates", "rapport_type_ids", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });
    await queryInterface.sequelize.query(`
      UPDATE rapport_document_templates
      SET rapport_type_ids = jsonb_build_array(rapport_type_id)
      WHERE rapport_type_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("rapport_document_templates", "rapport_type_ids");
  }
};
