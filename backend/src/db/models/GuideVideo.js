const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "GuideVideo",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      title_ar: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      description_ar: { type: DataTypes.TEXT, allowNull: true },
      description_fr: { type: DataTypes.TEXT, allowNull: true },
      audience: {
        type: DataTypes.ENUM("general", "ADMIN", "OFFICE_USER", "CHEF_CABINET", "WALI"),
        allowNull: false,
        defaultValue: "general"
      },
      uploaded_file_id: { type: DataTypes.BIGINT, allowNull: false },
      is_new: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    { tableName: "guide_videos", timestamps: false }
  );
