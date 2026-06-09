"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_wali_responses_follow_up_status" AS ENUM ('none', 'pending', 'completed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryInterface.addColumn("wali_responses", "follow_up_status", {
      type: Sequelize.ENUM("none", "pending", "completed"),
      allowNull: false,
      defaultValue: "none"
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("wali_responses", "follow_up_status");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wali_responses_follow_up_status";');
  }
};
