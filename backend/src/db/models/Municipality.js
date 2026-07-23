const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Municipality",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      name_ar: { type: DataTypes.STRING(255), allowNull: false },
      name_fr: { type: DataTypes.STRING(255), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      daira_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      hidden_at: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "municipalities", timestamps: false }
  );
