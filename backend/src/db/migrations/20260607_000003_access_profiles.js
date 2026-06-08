"use strict";

const bcrypt = require("bcryptjs");

const PERMISSIONS = [
  "hub.dashboard",
  "organization.municipalities.view",
  "organization.municipalities.manage",
  "organization.users.view",
  "organization.users.manage",
  "organization.access_roles.manage",
  "rapports.investissement.view",
  "rapports.investissement.manage",
  "rapports.investissement.export",
  "rapports.finance.view",
  "rapports.finance.manage",
  "rapports.finance.export",
  "rapports.hydraulique.view",
  "rapports.hydraulique.manage",
  "rapports.hydraulique.export",
  "rapports.inbox.view",
  "rapports.inbox.respond"
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("access_role_templates", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      account_scope: { type: Sequelize.ENUM("admin", "office", "wali"), allowNull: false },
      name_ar: { type: Sequelize.STRING(200), allowNull: false },
      name_fr: { type: Sequelize.STRING(200), allowNull: false },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }
    });

    await queryInterface.createTable("access_role_template_permissions", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      role_template_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "access_role_templates", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      permission_key: { type: Sequelize.STRING(120), allowNull: false },
      access_level: { type: Sequelize.ENUM("none", "view", "manage"), allowNull: false, defaultValue: "none" }
    });

    await queryInterface.addConstraint("access_role_template_permissions", {
      type: "unique",
      fields: ["role_template_id", "permission_key"],
      name: "uniq_access_role_template_permissions"
    });

    await queryInterface.createTable("user_permission_overrides", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      permission_key: { type: Sequelize.STRING(120), allowNull: false },
      access_level: { type: Sequelize.ENUM("none", "view", "manage"), allowNull: false }
    });

    await queryInterface.addConstraint("user_permission_overrides", {
      type: "unique",
      fields: ["user_id", "permission_key"],
      name: "uniq_user_permission_overrides"
    });

    await queryInterface.addConstraint("users", {
      fields: ["access_role_template_id"],
      type: "foreign key",
      name: "fk_users_access_role_template_id",
      references: { table: "access_role_templates", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    const now = new Date();

    await queryInterface.bulkInsert("departments", [
      { name_ar: "الاستثمار", name_fr: "Investissement", sort_order: 1, is_active: true },
      { name_ar: "المالية", name_fr: "Finance", sort_order: 2, is_active: true },
      { name_ar: "الموارد المائية", name_fr: "Hydraulique", sort_order: 3, is_active: true }
    ]);

    const [deptRows] = await queryInterface.sequelize.query(
      `SELECT id, name_fr FROM departments ORDER BY sort_order ASC`
    );
    const deptByFr = Object.fromEntries(deptRows.map((d) => [d.name_fr, d.id]));

    await queryInterface.bulkInsert("access_role_templates", [
      {
        slug: "ADMIN_FULL",
        account_scope: "admin",
        name_ar: "مدير النظام",
        name_fr: "Administrateur complet",
        is_system: true,
        is_active: true
      },
      {
        slug: "OFFICE_STANDARD",
        account_scope: "office",
        name_ar: "موظف مكتب — قياسي",
        name_fr: "Bureau — standard",
        is_system: true,
        is_active: true
      },
      {
        slug: "WALI_STANDARD",
        account_scope: "wali",
        name_ar: "والي — قياسي",
        name_fr: "Wali — standard",
        is_system: true,
        is_active: true
      }
    ]);

    const [tplRows] = await queryInterface.sequelize.query(`SELECT id, slug FROM access_role_templates`);
    const tplBySlug = Object.fromEntries(tplRows.map((t) => [t.slug, t.id]));

    const adminPerms = PERMISSIONS.map((k) => ({
      role_template_id: tplBySlug.ADMIN_FULL,
      permission_key: k,
      access_level: "manage"
    }));

    const officePerms = PERMISSIONS.filter((k) => !k.startsWith("organization.") || k === "hub.dashboard").map((k) => {
      let level = "none";
      if (k === "hub.dashboard") level = "view";
      if (k.startsWith("rapports.investissement")) level = k.endsWith(".view") ? "view" : "manage";
      if (k.startsWith("rapports.finance") || k.startsWith("rapports.hydraulique")) level = "view";
      return { role_template_id: tplBySlug.OFFICE_STANDARD, permission_key: k, access_level: level };
    });

    const waliPerms = PERMISSIONS.map((k) => ({
      role_template_id: tplBySlug.WALI_STANDARD,
      permission_key: k,
      access_level: k === "hub.dashboard" || k.startsWith("rapports.inbox") || k.endsWith(".view") ? "manage" : "none"
    }));

    await queryInterface.bulkInsert("access_role_template_permissions", [...adminPerms, ...officePerms, ...waliPerms]);

    const passwordHash = bcrypt.hashSync("12345678", 10);
    await queryInterface.bulkInsert("users", [
      {
        username: "admin",
        name: "Administrateur",
        password_hash: passwordHash,
        role: "ADMIN",
        access_role_template_id: tplBySlug.ADMIN_FULL,
        is_blocked: false,
        use_custom_permissions: false,
        email_hidden: false,
        created_at: now
      }
    ]);

    await queryInterface.bulkInsert("services", [
      {
        department_id: deptByFr.Investissement,
        slug: "investissement",
        name_ar: "تسوية المشاريع الاستثمارية",
        name_fr: "Tsuie des projets d'investissement",
        sort_order: 1,
        is_active: true
      },
      {
        department_id: deptByFr.Finance,
        slug: "finance",
        name_ar: "الوضعية المالية للبلديات",
        name_fr: "État financier des communes",
        sort_order: 2,
        is_active: true
      },
      {
        department_id: deptByFr.Hydraulique,
        slug: "hydraulique",
        name_ar: "السدود والموارد المائية",
        name_fr: "Barrages et hydraulique",
        sort_order: 3,
        is_active: true
      }
    ]);

    const [svcRows] = await queryInterface.sequelize.query(`SELECT id, slug FROM services`);
    const svcBySlug = Object.fromEntries(svcRows.map((s) => [s.slug, s.id]));

    await queryInterface.bulkInsert("rapport_types", [
      {
        service_id: svcBySlug.investissement,
        slug: "investissement_grid",
        name_ar: "جدول تسوية المشاريع الاستثمارية",
        name_fr: "Grille tsuie projets investissement",
        layout_kind: "grid",
        versioning_mode: "versioned",
        schema_json: JSON.stringify({ module: "RAPPORT_INVESTISSEMENT" })
      },
      {
        service_id: svcBySlug.investissement,
        slug: "investissement_memo",
        name_ar: "مذكرة استخلاصية",
        name_fr: "Mémoire synthétique",
        layout_kind: "memo",
        versioning_mode: "standalone",
        schema_json: null
      },
      {
        service_id: svcBySlug.hydraulique,
        slug: "barrages_etat",
        name_ar: "حالة السدود",
        name_fr: "État des barrages",
        layout_kind: "memo",
        versioning_mode: "standalone",
        schema_json: null
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("rapport_types", null, {});
    await queryInterface.bulkDelete("services", null, {});
    await queryInterface.bulkDelete("users", { username: "admin" }, {});
    await queryInterface.bulkDelete("access_role_template_permissions", null, {});
    await queryInterface.bulkDelete("access_role_templates", null, {});
    await queryInterface.bulkDelete("departments", null, {});
    await queryInterface.removeConstraint("users", "fk_users_access_role_template_id");
    await queryInterface.dropTable("user_permission_overrides");
    await queryInterface.dropTable("access_role_template_permissions");
    await queryInterface.dropTable("access_role_templates");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_access_role_templates_account_scope";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_access_role_template_permissions_access_level";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_permission_overrides_access_level";');
  }
};
