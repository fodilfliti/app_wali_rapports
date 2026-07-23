"use strict";

/** Phase 5 expand: additive UUID columns beside BIGINT PKs (no cutover yet). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      "users",
      "rapports",
      "rapport_versions",
      "services",
      "rapport_types",
      "uploaded_files",
      "notifications",
    ];

    for (const table of tables) {
      const desc = await queryInterface.describeTable(table);
      if (!desc.uuid) {
        await queryInterface.addColumn(table, "uuid", {
          type: Sequelize.UUID,
          allowNull: true,
          unique: true,
        });
      }
    }

    // Backfill UUID v4 where null (Postgres)
    for (const table of tables) {
      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET uuid = gen_random_uuid() WHERE uuid IS NULL`
      );
    }

    // Enforce NOT NULL after backfill
    for (const table of tables) {
      await queryInterface.changeColumn(table, "uuid", {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = [
      "users",
      "rapports",
      "rapport_versions",
      "services",
      "rapport_types",
      "uploaded_files",
      "notifications",
    ];
    for (const table of tables) {
      const desc = await queryInterface.describeTable(table);
      if (desc.uuid) {
        await queryInterface.removeColumn(table, "uuid");
      }
    }
  },
};
