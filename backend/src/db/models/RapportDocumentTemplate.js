const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportDocumentTemplate",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      service_id: { type: DataTypes.BIGINT, allowNull: false },
      rapport_type_id: { type: DataTypes.BIGINT, allowNull: true },
      rapport_type_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      content_kind: {
        type: DataTypes.ENUM("document_compose", "fiche_lecture"),
        allowNull: true
      },
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      content_json: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapport_document_templates", timestamps: false }
  );
