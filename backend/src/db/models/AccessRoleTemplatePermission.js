const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "AccessRoleTemplatePermission",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      role_template_id: { type: DataTypes.BIGINT, allowNull: false },
      permission_key: { type: DataTypes.STRING(120), allowNull: false },
      access_level: { type: DataTypes.ENUM("none", "view", "manage"), allowNull: false, defaultValue: "none" }
    },
    { tableName: "access_role_template_permissions", timestamps: false }
  );
