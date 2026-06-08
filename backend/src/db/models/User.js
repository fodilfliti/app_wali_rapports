const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      username: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(255), allowNull: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM("ADMIN", "OFFICE_USER", "WALI"), allowNull: false },
      department_id: { type: DataTypes.BIGINT, allowNull: true },
      job_title: { type: DataTypes.STRING(120), allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      email_hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      access_role_template_id: { type: DataTypes.BIGINT, allowNull: true },
      use_custom_permissions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_blocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    },
    {
      tableName: "users",
      timestamps: false,
      defaultScope: { attributes: { exclude: ["password_hash"] } },
      scopes: { withPassword: { attributes: { include: ["password_hash"] } } }
    }
  );
