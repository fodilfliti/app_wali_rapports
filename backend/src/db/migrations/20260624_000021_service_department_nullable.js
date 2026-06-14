"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("services", "services_department_id_fkey");
    await queryInterface.changeColumn("services", "department_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
    await queryInterface.addConstraint("services", {
      fields: ["department_id"],
      type: "foreign key",
      name: "services_department_id_fkey",
      references: { table: "departments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("services", "services_department_id_fkey");
    await queryInterface.changeColumn("services", "department_id", {
      type: Sequelize.BIGINT,
      allowNull: false,
    });
    await queryInterface.addConstraint("services", {
      fields: ["department_id"],
      type: "foreign key",
      name: "services_department_id_fkey",
      references: { table: "departments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};
