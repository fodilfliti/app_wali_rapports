const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "UserServiceGrant",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      service_id: { type: DataTypes.BIGINT, allowNull: false },
      access_level: { type: DataTypes.ENUM("view", "manage"), allowNull: false, defaultValue: "view" }
    },
    { tableName: "user_service_grants", updatedAt: false, createdAt: "created_at" }
  );
