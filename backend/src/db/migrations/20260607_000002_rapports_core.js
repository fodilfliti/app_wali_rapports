"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("departments", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }
    });

    await queryInterface.addConstraint("users", {
      fields: ["department_id"],
      type: "foreign key",
      name: "fk_users_department_id",
      references: { table: "departments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.createTable("services", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      department_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "departments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }
    });

    await queryInterface.createTable("rapport_types", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      service_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      slug: { type: Sequelize.STRING(80), allowNull: false },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      layout_kind: { type: Sequelize.ENUM("grid", "memo", "mixed"), allowNull: false, defaultValue: "grid" },
      versioning_mode: { type: Sequelize.ENUM("versioned", "standalone"), allowNull: false, defaultValue: "versioned" },
      schema_json: { type: Sequelize.JSONB, allowNull: true }
    });

    await queryInterface.addConstraint("rapport_types", {
      type: "unique",
      fields: ["service_id", "slug"],
      name: "uniq_rapport_types_service_slug"
    });

    await queryInterface.createTable("rapports", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      service_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      rapport_type_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapport_types", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      title: { type: Sequelize.STRING(500), allowNull: false },
      reference_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM("draft", "submitted", "under_review", "changes_requested", "acknowledged", "archived"),
        allowNull: false,
        defaultValue: "draft"
      },
      current_version_id: { type: Sequelize.BIGINT, allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.createTable("rapport_versions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      rapport_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "rapports", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      data_json: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });

    await queryInterface.addConstraint("rapport_versions", {
      type: "unique",
      fields: ["rapport_id", "version_number"],
      name: "uniq_rapport_versions_rapport_version"
    });

    await queryInterface.addConstraint("rapports", {
      fields: ["current_version_id"],
      type: "foreign key",
      name: "fk_rapports_current_version_id",
      references: { table: "rapport_versions", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.createTable("wali_responses", {
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
      decision: { type: Sequelize.ENUM("accepted", "changes_requested"), allowNull: false },
      body_text: { type: Sequelize.TEXT, allowNull: false },
      created_by_user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("wali_responses");
    await queryInterface.removeConstraint("rapports", "fk_rapports_current_version_id");
    await queryInterface.dropTable("rapport_versions");
    await queryInterface.dropTable("rapports");
    await queryInterface.dropTable("rapport_types");
    await queryInterface.dropTable("services");
    await queryInterface.removeConstraint("users", "fk_users_department_id");
    await queryInterface.dropTable("departments");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rapport_types_layout_kind";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rapport_types_versioning_mode";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rapports_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wali_responses_decision";');
  }
};
