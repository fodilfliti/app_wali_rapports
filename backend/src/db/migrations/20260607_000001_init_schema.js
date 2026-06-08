"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("municipalities", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      name_ar: { type: Sequelize.STRING(255), allowNull: false },
      name_fr: { type: Sequelize.STRING(255), allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("users", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      username: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM("ADMIN", "OFFICE_USER", "WALI"), allowNull: false },
      department_id: { type: Sequelize.BIGINT, allowNull: true },
      job_title: { type: Sequelize.STRING(120), allowNull: true },
      email: { type: Sequelize.STRING(255), allowNull: true },
      email_hidden: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      access_role_template_id: { type: Sequelize.BIGINT, allowNull: true },
      use_custom_permissions: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_blocked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("audit_logs", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      actor_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      action_type: { type: Sequelize.STRING(100), allowNull: false },
      details: { type: Sequelize.JSONB, allowNull: true },
      timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
    await queryInterface.dropTable("users");
    await queryInterface.dropTable("municipalities");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  }
};
