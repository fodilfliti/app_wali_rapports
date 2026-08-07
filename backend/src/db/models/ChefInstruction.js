const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "ChefInstruction",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      title_ar: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
      body_ar: { type: DataTypes.TEXT, allowNull: true },
      body_fr: { type: DataTypes.TEXT, allowNull: true },
      created_by_user_id: { type: DataTypes.BIGINT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "chef_instructions", timestamps: false },
  );
