const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "UploadedFile",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      storage_key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      rapport_id: { type: DataTypes.BIGINT, allowNull: true },
      uploaded_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      original_name: { type: DataTypes.STRING(255), allowNull: false },
      mime_type: { type: DataTypes.STRING(120), allowNull: false },
      size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
      media_kind: { type: DataTypes.ENUM("image", "video", "file"), allowNull: false, defaultValue: "file" },
      storage_rel_path: { type: DataTypes.STRING(512), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "uploaded_files", timestamps: false }
  );
