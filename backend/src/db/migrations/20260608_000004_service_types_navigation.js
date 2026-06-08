"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "parent_service_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "services", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("services", "is_folder", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("rapport_types", "content_kind", {
      type: Sequelize.ENUM("table_grid", "document_compose", "fiche_lecture", "commune_list"),
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      UPDATE rapport_types SET content_kind = 'table_grid'
      WHERE layout_kind = 'grid' AND content_kind IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_types SET content_kind = 'document_compose'
      WHERE layout_kind IN ('memo', 'mixed') AND content_kind IS NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE rapport_types ALTER COLUMN content_kind SET DEFAULT 'table_grid'
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_types SET content_kind = 'table_grid' WHERE content_kind IS NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE rapport_types ALTER COLUMN content_kind SET NOT NULL
    `);

    await queryInterface.addColumn("rapports", "owner_office_user_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.createTable("rapport_table_schemas", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      service_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      columns_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("notifications", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      wali_response_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: "wali_responses", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      message_key: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "waliFeedback" },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_wali_responses_decision" ADD VALUE 'viewed'`);
    } catch (e) {
      /* already exists */
    }

    await queryInterface.addColumn("wali_responses", "scope", {
      type: Sequelize.ENUM("whole_rapport", "table", "document", "commune"),
      allowNull: false,
      defaultValue: "whole_rapport"
    });
    await queryInterface.addColumn("wali_responses", "scope_id", {
      type: Sequelize.STRING(120),
      allowNull: true
    });

    const [financeRows] = await queryInterface.sequelize.query(
      `SELECT id, department_id FROM services WHERE slug = 'finance' LIMIT 1`
    );
    if (financeRows.length) {
      const { id: financeId, department_id: deptId } = financeRows[0];
      await queryInterface.sequelize.query(`UPDATE services SET is_folder = true WHERE id = ${financeId}`);
      await queryInterface.bulkInsert("services", [
        {
          department_id: deptId,
          slug: "finance-banque",
          name_ar: "البنك",
          name_fr: "Banque",
          sort_order: 1,
          is_active: true,
          is_folder: false,
          parent_service_id: financeId
        },
        {
          department_id: deptId,
          slug: "finance-budget-projets",
          name_ar: "ميزانية المشاريع",
          name_fr: "Budget projets",
          sort_order: 2,
          is_active: true,
          is_folder: false,
          parent_service_id: financeId
        }
      ]);
    }

    const [invRows] = await queryInterface.sequelize.query(
      `SELECT id FROM services WHERE slug = 'investissement' LIMIT 1`
    );
    if (invRows.length) {
      await queryInterface.bulkInsert("rapport_types", [
        {
          service_id: invRows[0].id,
          slug: "fiche_lecture_wilaya",
          name_ar: "بطاقة مطالعة",
          name_fr: "Fiche lecture",
          layout_kind: "memo",
          content_kind: "fiche_lecture",
          versioning_mode: "standalone",
          schema_json: null
        }
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("rapport_types", { slug: "fiche_lecture_wilaya" }, {});
    await queryInterface.bulkDelete("services", { slug: "finance-banque" }, {});
    await queryInterface.bulkDelete("services", { slug: "finance-budget-projets" }, {});
    await queryInterface.dropTable("notifications");
    await queryInterface.dropTable("rapport_table_schemas");
    await queryInterface.removeColumn("wali_responses", "scope_id");
    await queryInterface.removeColumn("wali_responses", "scope");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wali_responses_scope";');
    await queryInterface.removeColumn("rapports", "owner_office_user_id");
    await queryInterface.removeColumn("rapport_types", "content_kind");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rapport_types_content_kind";');
    await queryInterface.removeColumn("services", "is_folder");
    await queryInterface.removeColumn("services", "parent_service_id");
  }
};
