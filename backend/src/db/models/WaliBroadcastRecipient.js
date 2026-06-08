const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "WaliBroadcastRecipient",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      broadcast_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      read_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "wali_broadcast_recipients", timestamps: false }
  );
