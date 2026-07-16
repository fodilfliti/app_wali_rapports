"use strict";

/** Device notifications: prefs, push subscriptions, calendar_event_id, calendar day-scan marker. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_notification_preferences", {
      user_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      push_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      rapport_inbox: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      rapport_feedback: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      discussion: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      instructions: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      broadcasts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      calendar: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("web_push_subscriptions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.STRING(255), allowNull: false },
      auth: { type: Sequelize.STRING(255), allowNull: false },
      user_agent: { type: Sequelize.STRING(500), allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("web_push_subscriptions", ["endpoint"], {
      unique: true,
      name: "web_push_subscriptions_endpoint_uidx",
    });
    await queryInterface.addIndex("web_push_subscriptions", ["user_id"], {
      name: "web_push_subscriptions_user_id_idx",
    });

    await queryInterface.addColumn("users", "calendar_reminders_checked_on", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn("notifications", "calendar_event_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "rapport_calendar_events", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addIndex(
      "notifications",
      ["user_id", "calendar_event_id", "message_key"],
      {
        unique: true,
        name: "notifications_user_calendar_event_key_uidx",
        where: Sequelize.literal("calendar_event_id IS NOT NULL"),
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "notifications",
      "notifications_user_calendar_event_key_uidx",
    );
    await queryInterface.removeColumn("notifications", "calendar_event_id");
    await queryInterface.removeColumn("users", "calendar_reminders_checked_on");
    await queryInterface.dropTable("web_push_subscriptions");
    await queryInterface.dropTable("user_notification_preferences");
  },
};
