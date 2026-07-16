const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "WaliInstructionFile",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      instruction_id: { type: DataTypes.BIGINT, allowNull: false },
      uploaded_file_id: { type: DataTypes.BIGINT, allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    },
    { tableName: "wali_instruction_files", timestamps: false }
  );
