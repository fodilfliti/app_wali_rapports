"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("rapport_comments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      author_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      rapport_version_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "rapport_versions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      body_text: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("rapport_comments", ["rapport_id", "created_at"]);

    await queryInterface.addColumn("notifications", "comment_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "rapport_comments", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("notifications", "comment_id");
    await queryInterface.dropTable("rapport_comments");
  }
};
