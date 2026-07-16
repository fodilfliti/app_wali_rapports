const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      rapport_id: { type: DataTypes.BIGINT, allowNull: true },
      broadcast_id: { type: DataTypes.BIGINT, allowNull: true },
      instruction_id: { type: DataTypes.BIGINT, allowNull: true },
      wali_response_id: { type: DataTypes.BIGINT, allowNull: true },
      chef_response_id: { type: DataTypes.BIGINT, allowNull: true },
      comment_id: { type: DataTypes.BIGINT, allowNull: true },
      message_key: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "waliFeedback" },
      read_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "notifications", timestamps: false }
  );
