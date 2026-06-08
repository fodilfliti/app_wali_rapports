const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "WaliBroadcast",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uploaded_file_id: { type: DataTypes.BIGINT, allowNull: false },
      title_ar: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      message_ar: { type: DataTypes.TEXT, allowNull: true },
      message_fr: { type: DataTypes.TEXT, allowNull: true },
      allow_comments: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "wali_broadcasts", timestamps: false }
  );
