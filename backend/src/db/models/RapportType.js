const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportType",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      service_id: { type: DataTypes.BIGINT, allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      layout_kind: { type: DataTypes.ENUM("grid", "memo", "mixed"), allowNull: false, defaultValue: "grid" },
      content_kind: {
        type: DataTypes.ENUM("table_grid", "document_compose", "fiche_lecture", "commune_list"),
        allowNull: false,
        defaultValue: "table_grid"
      },
      versioning_mode: { type: DataTypes.ENUM("versioned", "standalone"), allowNull: false, defaultValue: "versioned" },
      schema_json: { type: DataTypes.JSONB, allowNull: true }
    },
    { tableName: "rapport_types", timestamps: false }
  );
