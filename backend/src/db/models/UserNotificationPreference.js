const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "UserNotificationPreference",
    {
      user_id: { type: DataTypes.BIGINT, primaryKey: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      rapport_inbox: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      rapport_feedback: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      discussion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      instructions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      chef_instructions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      broadcasts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      calendar: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "user_notification_preferences", timestamps: false },
  );
