"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("chef_instructions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      title_ar: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      body_ar: { type: Sequelize.TEXT, allowNull: true },
      body_fr: { type: Sequelize.TEXT, allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.createTable("chef_instruction_files", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      instruction_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "chef_instructions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      uploaded_file_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "uploaded_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.createTable("chef_instruction_recipients", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      instruction_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "chef_instructions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });
    await queryInterface.addIndex("chef_instruction_recipients", ["instruction_id", "user_id"], {
      unique: true,
    });

    await queryInterface.addColumn("notifications", "chef_instruction_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "chef_instructions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("user_notification_preferences", "chef_instructions", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("user_notification_preferences", "chef_instructions");
    await queryInterface.removeColumn("notifications", "chef_instruction_id");
    await queryInterface.dropTable("chef_instruction_recipients");
    await queryInterface.dropTable("chef_instruction_files");
    await queryInterface.dropTable("chef_instructions");
  },
};
