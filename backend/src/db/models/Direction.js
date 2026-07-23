const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Direction",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(255), allowNull: false },
      name_fr: { type: DataTypes.STRING(255), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      hidden_at: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "directions", timestamps: false }
  );
