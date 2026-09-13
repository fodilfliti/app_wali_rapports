"use strict";

/**
 * Org-scoped services:
 * - services.org_scope (diwan | daira | commune | direction)
 * - optional daira_id / municipality_id / direction_id on leaves
 * - backfill existing → diwan
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface.sequelize;

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_services_org_scope" AS ENUM ('diwan', 'daira', 'commune', 'direction');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.addColumn("services", "org_scope", {
      type: "enum_services_org_scope",
      allowNull: false,
      defaultValue: "diwan",
    });

    await queryInterface.addColumn("services", "daira_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "dairas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("services", "municipality_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "municipalities", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("services", "direction_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "directions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await qi.query(`UPDATE services SET org_scope = 'diwan' WHERE org_scope IS NULL OR org_scope = 'diwan'`);

    await qi.query(`
      ALTER TABLE services
      ADD CONSTRAINT services_org_scope_unit_check CHECK (
        (
          org_scope = 'diwan'
          AND daira_id IS NULL
          AND municipality_id IS NULL
          AND direction_id IS NULL
        )
        OR (
          org_scope = 'daira'
          AND daira_id IS NOT NULL
          AND municipality_id IS NULL
          AND direction_id IS NULL
        )
        OR (
          org_scope = 'commune'
          AND municipality_id IS NOT NULL
          AND daira_id IS NULL
          AND direction_id IS NULL
        )
        OR (
          org_scope = 'direction'
          AND direction_id IS NOT NULL
          AND daira_id IS NULL
          AND municipality_id IS NULL
        )
        OR (
          is_folder = true
          AND daira_id IS NULL
          AND municipality_id IS NULL
          AND direction_id IS NULL
        )
      )
    `);

    await queryInterface.addIndex("services", ["org_scope"], {
      name: "services_org_scope_idx",
    });
    await queryInterface.addIndex("services", ["daira_id"], {
      name: "services_daira_id_idx",
    });
    await queryInterface.addIndex("services", ["municipality_id"], {
      name: "services_municipality_id_idx",
    });
    await queryInterface.addIndex("services", ["direction_id"], {
      name: "services_direction_id_idx",
    });
  },

  async down(queryInterface) {
    const qi = queryInterface.sequelize;
    await qi.query(`ALTER TABLE services DROP CONSTRAINT IF EXISTS services_org_scope_unit_check`);
    await queryInterface.removeIndex("services", "services_org_scope_idx").catch(() => {});
    await queryInterface.removeIndex("services", "services_daira_id_idx").catch(() => {});
    await queryInterface.removeIndex("services", "services_municipality_id_idx").catch(() => {});
    await queryInterface.removeIndex("services", "services_direction_id_idx").catch(() => {});
    await queryInterface.removeColumn("services", "direction_id");
    await queryInterface.removeColumn("services", "municipality_id");
    await queryInterface.removeColumn("services", "daira_id");
    await queryInterface.removeColumn("services", "org_scope");
    await qi.query(`DROP TYPE IF EXISTS "enum_services_org_scope"`);
  },
};
