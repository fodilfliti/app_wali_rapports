"use strict";

const tlemcenDairas = require("../seed-data/tlemcen-dairas");
const tlemcenMunicipalities = require("../seed-data/tlemcen-municipalities");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Role CHEF_CABINET ---
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'CHEF_CABINET'`
    );

    // --- Rapport status pending_chef + chef_gate ---
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_rapports_status" ADD VALUE IF NOT EXISTS 'pending_chef'`
    );
    await queryInterface.addColumn("rapports", "chef_gate", {
      type: Sequelize.ENUM("required", "bypass"),
      allowNull: false,
      defaultValue: "required"
    });
    // In-flight work: do not re-block under chef
    await queryInterface.sequelize.query(
      `UPDATE rapports SET chef_gate = 'bypass' WHERE status NOT IN ('draft')`
    );

    // --- entity_target_kinds on rapport_types ---
    await queryInterface.addColumn("rapport_types", "entity_target_kinds", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: ["commune"]
    });

    // --- dairas ---
    await queryInterface.createTable("dairas", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name_ar: { type: Sequelize.STRING(255), allowNull: false },
      name_fr: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    // --- modiriyat ---
    await queryInterface.createTable("modiriyat", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name_ar: { type: Sequelize.STRING(255), allowNull: false },
      name_fr: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    // Seed dairas
    const now = new Date();
    await queryInterface.bulkInsert(
      "dairas",
      tlemcenDairas.map((d) => ({ ...d, created_at: now }))
    );

    // municipalities.daira_id
    await queryInterface.addColumn("municipalities", "daira_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "dairas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });

    const [dairaRows] = await queryInterface.sequelize.query(`SELECT id, code FROM dairas`);
    const dairaByCode = Object.fromEntries(dairaRows.map((r) => [r.code, r.id]));
    for (const m of tlemcenMunicipalities) {
      const dairaId = dairaByCode[m.daira_code];
      if (!dairaId) continue;
      await queryInterface.sequelize.query(
        `UPDATE municipalities SET daira_id = :dairaId WHERE code = :code`,
        { replacements: { dairaId, code: m.code } }
      );
    }
    // Fallback: any leftover without daira → Tlemcen daira
    const fallbackId = dairaByCode["1301"];
    if (fallbackId) {
      await queryInterface.sequelize.query(
        `UPDATE municipalities SET daira_id = :fallbackId WHERE daira_id IS NULL`,
        { replacements: { fallbackId } }
      );
    }
    await queryInterface.changeColumn("municipalities", "daira_id", {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: { model: "dairas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });

    // --- chef_responses ---
    await queryInterface.createTable("chef_responses", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      rapport_version_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapport_versions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      decision: {
        type: Sequelize.ENUM("accepted", "changes_requested", "viewed"),
        allowNull: false
      },
      follow_up_status: {
        type: Sequelize.ENUM("none", "pending", "completed"),
        allowNull: false,
        defaultValue: "none"
      },
      body_text: { type: Sequelize.TEXT, allowNull: false, defaultValue: "" },
      scope: {
        type: Sequelize.ENUM("whole_rapport", "table", "document", "commune"),
        allowNull: false,
        defaultValue: "whole_rapport"
      },
      scope_id: { type: Sequelize.STRING(120), allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("chef_responses", ["rapport_id"]);

    // --- wali_instructions ---
    await queryInterface.createTable("wali_instructions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      title_ar: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      title_fr: { type: Sequelize.STRING(200), allowNull: false, defaultValue: "" },
      body_ar: { type: Sequelize.TEXT, allowNull: true },
      body_fr: { type: Sequelize.TEXT, allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("wali_instruction_files", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      instruction_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "wali_instructions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      uploaded_file_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "uploaded_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
    });

    await queryInterface.createTable("wali_instruction_recipients", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      instruction_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "wali_instructions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
    await queryInterface.addIndex("wali_instruction_recipients", ["instruction_id", "user_id"], {
      unique: true
    });

    await queryInterface.addColumn("notifications", "instruction_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "wali_instructions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("notifications", "chef_response_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "chef_responses", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_access_role_templates_account_scope" ADD VALUE IF NOT EXISTS 'chef'`
    );
    const [templates] = await queryInterface.sequelize.query(
      `SELECT id FROM access_role_templates WHERE slug = 'CHEF_STANDARD' LIMIT 1`
    );
    if (!templates.length) {
      await queryInterface.bulkInsert("access_role_templates", [
        {
          slug: "CHEF_STANDARD",
          name_ar: "رئيس الديوان — قياسي",
          name_fr: "Chef de cabinet — standard",
          account_scope: "chef",
          is_system: true,
          is_active: true
        }
      ]);
      const [[chefTpl]] = await queryInterface.sequelize.query(
        `SELECT id FROM access_role_templates WHERE slug = 'CHEF_STANDARD' LIMIT 1`
      );
      if (chefTpl?.id) {
        await queryInterface.bulkInsert("access_role_template_permissions", [
          { role_template_id: chefTpl.id, permission_key: "hub.dashboard", access_level: "view" },
          { role_template_id: chefTpl.id, permission_key: "rapports.inbox.view", access_level: "view" },
          { role_template_id: chefTpl.id, permission_key: "rapports.inbox.respond", access_level: "manage" }
        ]);
      }
    }

    // Migrate commune list data_json keys (best-effort)
    const [versions] = await queryInterface.sequelize.query(
      `SELECT id, data_json FROM rapport_versions WHERE data_json ? 'communes'`
    );
    for (const row of versions) {
      const data = row.data_json;
      if (!data?.communes || typeof data.communes !== "object") continue;
      const keys = Object.keys(data.communes);
      if (!keys.length || keys.some((k) => k.includes(":"))) continue;
      const entities = {};
      for (const [code, val] of Object.entries(data.communes)) {
        entities[`commune:${code}`] = val;
      }
      const next = { ...data, entities, communes: data.communes };
      await queryInterface.sequelize.query(
        `UPDATE rapport_versions SET data_json = :data::jsonb WHERE id = :id`,
        { replacements: { id: row.id, data: JSON.stringify(next) } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("notifications", "chef_response_id");
    await queryInterface.removeColumn("notifications", "instruction_id");
    await queryInterface.dropTable("wali_instruction_recipients");
    await queryInterface.dropTable("wali_instruction_files");
    await queryInterface.dropTable("wali_instructions");
    await queryInterface.dropTable("chef_responses");
    await queryInterface.removeColumn("municipalities", "daira_id");
    await queryInterface.dropTable("modiriyat");
    await queryInterface.dropTable("dairas");
    await queryInterface.removeColumn("rapport_types", "entity_target_kinds");
    await queryInterface.removeColumn("rapports", "chef_gate");
    // ENUM values cannot be easily removed in Postgres — leave them
  }
};
