"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_service_grants", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      service_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      access_level: {
        type: Sequelize.ENUM("view", "manage"),
        allowNull: false,
        defaultValue: "view"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("user_service_grants", {
      type: "unique",
      fields: ["user_id", "service_id"],
      name: "uniq_user_service_grants_user_service"
    });

    const [officeUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE role = 'OFFICE_USER' AND is_blocked = false`
    );
    const [services] = await queryInterface.sequelize.query(
      `SELECT id FROM services WHERE is_active = true AND is_folder = false`
    );

    const grants = [];
    for (const u of officeUsers) {
      for (const s of services) {
        grants.push({
          user_id: u.id,
          service_id: s.id,
          access_level: "manage"
        });
      }
    }
    if (grants.length) {
      await queryInterface.bulkInsert("user_service_grants", grants);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_service_grants");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_service_grants_access_level";');
  }
};
