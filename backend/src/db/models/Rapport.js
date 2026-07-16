const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Rapport",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      service_id: { type: DataTypes.BIGINT, allowNull: false },
      rapport_type_id: { type: DataTypes.BIGINT, allowNull: false },
      title: { type: DataTypes.STRING(500), allowNull: false },
      reference_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM(
          "draft",
          "pending_chef",
          "submitted",
          "under_review",
          "changes_requested",
          "acknowledged",
          "archived"
        ),
        allowNull: false,
        defaultValue: "draft"
      },
      chef_gate: {
        type: DataTypes.ENUM("required", "bypass"),
        allowNull: false,
        defaultValue: "required"
      },
      current_version_id: { type: DataTypes.BIGINT, allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      owner_office_user_id: { type: DataTypes.BIGINT, allowNull: true },
      hidden_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapports", timestamps: false }
  );
