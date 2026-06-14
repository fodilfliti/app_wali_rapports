const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportVersion",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      rapport_id: { type: DataTypes.BIGINT, allowNull: false },
      version_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      data_json: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      changed_commune_codes: { type: DataTypes.JSONB, allowNull: true },
      commune_versions: { type: DataTypes.JSONB, allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapport_versions", timestamps: false }
  );
