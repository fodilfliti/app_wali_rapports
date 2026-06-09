"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("rapport_document_templates", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      service_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "services", key: "id" },
        onDelete: "CASCADE"
      },
      rapport_type_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "rapport_types", key: "id" },
        onDelete: "SET NULL"
      },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      content_kind: {
        type: Sequelize.ENUM("document_compose", "fiche_lecture"),
        allowNull: true
      },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      content_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") }
    });
    await queryInterface.addIndex("rapport_document_templates", ["service_id"]);
    await queryInterface.addIndex("rapport_document_templates", ["rapport_type_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("rapport_document_templates");
  }
};
