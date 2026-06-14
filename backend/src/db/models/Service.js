const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Service",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      department_id: { type: DataTypes.BIGINT, allowNull: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      parent_service_id: { type: DataTypes.BIGINT, allowNull: true },
      is_folder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    { tableName: "services", timestamps: false }
  );
