const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "UserPermissionOverride",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      permission_key: { type: DataTypes.STRING(120), allowNull: false },
      access_level: { type: DataTypes.ENUM("none", "view", "manage"), allowNull: false }
    },
    { tableName: "user_permission_overrides", timestamps: false }
  );
