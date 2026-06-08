const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportTableSchema",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      service_id: { type: DataTypes.BIGINT, allowNull: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      columns_json: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      layout_json: { type: DataTypes.JSONB, allowNull: true },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapport_table_schemas", timestamps: false }
  );
