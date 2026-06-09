const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "WaliResponse",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      rapport_id: { type: DataTypes.BIGINT, allowNull: false },
      rapport_version_id: { type: DataTypes.BIGINT, allowNull: false },
      decision: { type: DataTypes.ENUM("accepted", "changes_requested", "viewed"), allowNull: false },
      follow_up_status: {
        type: DataTypes.ENUM("none", "pending", "completed"),
        allowNull: false,
        defaultValue: "none"
      },
      body_text: { type: DataTypes.TEXT, allowNull: false },
      scope: {
        type: DataTypes.ENUM("whole_rapport", "table", "document", "commune"),
        allowNull: false,
        defaultValue: "whole_rapport"
      },
      scope_id: { type: DataTypes.STRING(120), allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "wali_responses", timestamps: false }
  );
