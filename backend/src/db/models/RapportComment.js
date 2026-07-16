const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RapportComment",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      rapport_id: { type: DataTypes.BIGINT, allowNull: false },
      author_user_id: { type: DataTypes.BIGINT, allowNull: false },
      rapport_version_id: { type: DataTypes.BIGINT, allowNull: true },
      body_text: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "rapport_comments", timestamps: false }
  );
