"use strict";

/** Phase 5 expand: UUID columns for URL-facing entities still on BIGINT PKs. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      "wali_broadcasts",
      "wali_instructions",
      "guide_videos",
      "departments",
      "dairas",
      "directions",
      "municipalities",
      "rapport_table_schemas",
      "rapport_document_templates",
      "rapport_comments",
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

    for (const table of tables) {
      await queryInterface.sequelize.query(
        `UPDATE "${table}" SET uuid = gen_random_uuid() WHERE uuid IS NULL`
      );
    }

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
      "wali_broadcasts",
      "wali_instructions",
      "guide_videos",
      "departments",
      "dairas",
      "directions",
      "municipalities",
      "rapport_table_schemas",
      "rapport_document_templates",
      "rapport_comments",
    ];
    for (const table of tables) {
      const desc = await queryInterface.describeTable(table);
      if (desc.uuid) {
        await queryInterface.removeColumn(table, "uuid");
      }
    }
  },
};
