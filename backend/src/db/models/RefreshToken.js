const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "RefreshToken",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      family_id: { type: DataTypes.UUID, allowNull: false },
      family_expires_at: { type: DataTypes.DATE, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      replaced_by_id: { type: DataTypes.BIGINT, allowNull: true },
      user_agent: { type: DataTypes.STRING(512), allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "refresh_tokens",
      timestamps: false
    }
  );
