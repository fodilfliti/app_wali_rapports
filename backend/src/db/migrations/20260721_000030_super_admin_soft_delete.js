"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "is_super_admin", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("users", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex("users", ["deleted_at"], {
      name: "users_deleted_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("users", "users_deleted_at_idx");
    await queryInterface.removeColumn("users", "deleted_at");
    await queryInterface.removeColumn("users", "is_super_admin");
  },
};
