const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AuditLog",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      actor_id: { type: DataTypes.BIGINT, allowNull: true },
      action_type: { type: DataTypes.STRING(100), allowNull: false },
      details: { type: DataTypes.JSONB, allowNull: true },
      timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "audit_logs", timestamps: false }
  );
