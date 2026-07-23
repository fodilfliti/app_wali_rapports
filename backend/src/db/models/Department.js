const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Department",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    },
    { tableName: "departments", timestamps: false }
  );
