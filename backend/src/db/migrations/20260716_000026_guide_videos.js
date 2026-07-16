"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("guide_videos", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      title_ar: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      description_ar: { type: Sequelize.TEXT, allowNull: true },
      description_fr: { type: Sequelize.TEXT, allowNull: true },
      audience: {
        type: Sequelize.ENUM("general", "ADMIN", "OFFICE_USER", "CHEF_CABINET", "WALI"),
        allowNull: false,
        defaultValue: "general"
      },
      uploaded_file_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "uploaded_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      is_new: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("guide_videos", ["audience"]);
    await queryInterface.addIndex("guide_videos", ["is_new"]);
    await queryInterface.addIndex("guide_videos", ["sort_order"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("guide_videos");
  }
};
