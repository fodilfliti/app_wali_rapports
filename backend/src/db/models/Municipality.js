const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Municipality",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      name_ar: { type: DataTypes.STRING(255), allowNull: false },
      name_fr: { type: DataTypes.STRING(255), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      daira_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "municipalities", timestamps: false }
  );
