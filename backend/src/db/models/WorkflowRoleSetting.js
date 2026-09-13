const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "WorkflowRoleSetting",
    {
      role: {
        type: DataTypes.ENUM(
          "OFFICE_USER",
          "PRESIDENT_DAIRA",
          "PRESIDENT_COMMUNE",
          "DIRECTEUR_DIRECTION"
        ),
        allowNull: false,
        primaryKey: true,
      },
      chef_validate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    { tableName: "workflow_role_settings", timestamps: false }
  );
