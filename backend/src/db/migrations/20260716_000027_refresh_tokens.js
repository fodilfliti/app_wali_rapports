"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refresh_tokens", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      family_id: { type: Sequelize.UUID, allowNull: false },
      family_expires_at: { type: Sequelize.DATE, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      replaced_by_id: { type: Sequelize.BIGINT, allowNull: true },
      user_agent: { type: Sequelize.STRING(512), allowNull: true },
      ip: { type: Sequelize.STRING(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("refresh_tokens", ["user_id"]);
    await queryInterface.addIndex("refresh_tokens", ["family_id"]);
    await queryInterface.addIndex("refresh_tokens", ["expires_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refresh_tokens");
  }
};
