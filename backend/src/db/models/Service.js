const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "Service",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
      department_id: { type: DataTypes.BIGINT, allowNull: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      name_ar: { type: DataTypes.STRING(200), allowNull: false },
      name_fr: { type: DataTypes.STRING(200), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      parent_service_id: { type: DataTypes.BIGINT, allowNull: true },
      is_folder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      org_scope: {
        type: DataTypes.ENUM("diwan", "daira", "commune", "direction"),
        allowNull: false,
        defaultValue: "diwan",
      },
      daira_id: { type: DataTypes.BIGINT, allowNull: true },
      municipality_id: { type: DataTypes.BIGINT, allowNull: true },
      direction_id: { type: DataTypes.BIGINT, allowNull: true },
    },
    { tableName: "services", timestamps: false }
  );
