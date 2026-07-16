const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Daira",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(255), allowNull: false },
      name_fr: { type: DataTypes.STRING(255), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "dairas", timestamps: false }
  );
