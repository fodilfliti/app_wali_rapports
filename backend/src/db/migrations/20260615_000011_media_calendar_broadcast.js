"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("uploaded_files", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      storage_key: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      uploaded_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(120), allowNull: false },
      size_bytes: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      media_kind: {
        type: Sequelize.ENUM("image", "video", "file"),
        allowNull: false,
        defaultValue: "file"
      },
      storage_rel_path: { type: Sequelize.STRING(512), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("rapport_calendar_events", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      event_date: { type: Sequelize.DATEONLY, allowNull: false },
      title_ar: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      note_ar: { type: Sequelize.TEXT, allowNull: true },
      note_fr: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex("rapport_calendar_events", ["rapport_id"]);
    await queryInterface.addIndex("rapport_calendar_events", ["event_date"]);

    await queryInterface.createTable("rapport_views", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      viewed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("rapport_views", ["rapport_id", "user_id"], { unique: true });

    await queryInterface.createTable("wali_broadcasts", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      uploaded_file_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "uploaded_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      title_ar: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      message_ar: { type: Sequelize.TEXT, allowNull: true },
      message_fr: { type: Sequelize.TEXT, allowNull: true },
      allow_comments: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("wali_broadcast_recipients", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      broadcast_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "wali_broadcasts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("wali_broadcast_recipients", ["broadcast_id", "user_id"], { unique: true });

    await queryInterface.createTable("wali_broadcast_comments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      broadcast_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "wali_broadcasts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      body_text: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.changeColumn("notifications", "rapport_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "rapports", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
    await queryInterface.addColumn("notifications", "broadcast_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "wali_broadcasts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("notifications", "broadcast_id");
    await queryInterface.changeColumn("notifications", "rapport_id", {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: { model: "rapports", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
    await queryInterface.dropTable("wali_broadcast_comments");
    await queryInterface.dropTable("wali_broadcast_recipients");
    await queryInterface.dropTable("wali_broadcasts");
    await queryInterface.dropTable("rapport_views");
    await queryInterface.dropTable("rapport_calendar_events");
    await queryInterface.dropTable("uploaded_files");
  }
};
