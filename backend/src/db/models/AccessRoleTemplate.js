const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AccessRoleTemplate",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      account_scope: { type: DataTypes.ENUM("admin", "office", "chef", "wali"), allowNull: false },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    },
    { tableName: "access_role_templates", timestamps: false }
  );
