const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "GuideVideoAudience",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      guide_video_id: { type: DataTypes.BIGINT, allowNull: false },
      audience: {
        type: DataTypes.ENUM(
          "general",
          "ADMIN",
          "OFFICE_USER",
          "CHEF_CABINET",
          "WALI",
          "PRESIDENT_DAIRA",
          "PRESIDENT_COMMUNE",
          "DIRECTEUR_DIRECTION"
        ),
        allowNull: false,
      },
    },
    { tableName: "guide_video_audiences", timestamps: false }
  );
