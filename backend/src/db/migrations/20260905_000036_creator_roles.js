"use strict";

/**
 * Creator roles expansion:
 * - PRESIDENT_DAIRA, PRESIDENT_COMMUNE, DIRECTEUR_DIRECTION on users.role
 * - users.daira_id / municipality_id / direction_id
 * - workflow_role_settings (chef_validate per creator role)
 * - DAIRA/COMMUNE/DIRECTION_STANDARD templates (clone OFFICE_STANDARD perms)
 * - guide_videos audience enum +3
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface.sequelize;

    for (const role of ["PRESIDENT_DAIRA", "PRESIDENT_COMMUNE", "DIRECTEUR_DIRECTION"]) {
      await qi.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS '${role}'`);
    }

    await queryInterface.addColumn("users", "daira_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "dairas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("users", "municipality_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "municipalities", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addColumn("users", "direction_id", {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: "directions", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.createTable("workflow_role_settings", {
      role: {
        type: Sequelize.ENUM(
          "OFFICE_USER",
          "PRESIDENT_DAIRA",
          "PRESIDENT_COMMUNE",
          "DIRECTEUR_DIRECTION"
        ),
        allowNull: false,
        primaryKey: true,
      },
      chef_validate: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    const now = new Date();
    await queryInterface.bulkInsert("workflow_role_settings", [
      { role: "OFFICE_USER", chef_validate: true, updated_at: now },
      { role: "PRESIDENT_DAIRA", chef_validate: true, updated_at: now },
      { role: "PRESIDENT_COMMUNE", chef_validate: true, updated_at: now },
      { role: "DIRECTEUR_DIRECTION", chef_validate: true, updated_at: now },
    ]);

    for (const aud of ["PRESIDENT_DAIRA", "PRESIDENT_COMMUNE", "DIRECTEUR_DIRECTION"]) {
      await qi.query(`ALTER TYPE "enum_guide_videos_audience" ADD VALUE IF NOT EXISTS '${aud}'`);
    }

    await queryInterface.bulkInsert("access_role_templates", [
      {
        slug: "DAIRA_STANDARD",
        account_scope: "office",
        name_ar: "رئيس الدائرة — قياسي",
        name_fr: "Président de daïra — standard",
        is_system: true,
        is_active: true,
      },
      {
        slug: "COMMUNE_STANDARD",
        account_scope: "office",
        name_ar: "رئيس البلدية — قياسي",
        name_fr: "Président de commune — standard",
        is_system: true,
        is_active: true,
      },
      {
        slug: "DIRECTION_STANDARD",
        account_scope: "office",
        name_ar: "مدير المديرية — قياسي",
        name_fr: "Directeur de direction — standard",
        is_system: true,
        is_active: true,
      },
    ]);

    const [officePerms] = await qi.query(`
      SELECT permission_key, access_level
      FROM access_role_template_permissions
      WHERE role_template_id = (
        SELECT id FROM access_role_templates WHERE slug = 'OFFICE_STANDARD' LIMIT 1
      )
    `);

    const [tplRows] = await qi.query(`
      SELECT id, slug FROM access_role_templates
      WHERE slug IN ('DAIRA_STANDARD', 'COMMUNE_STANDARD', 'DIRECTION_STANDARD')
    `);
    const tplBySlug = Object.fromEntries(tplRows.map((t) => [t.slug, t.id]));

    const rows = [];
    for (const slug of ["DAIRA_STANDARD", "COMMUNE_STANDARD", "DIRECTION_STANDARD"]) {
      const tid = tplBySlug[slug];
      if (!tid) continue;
      for (const p of officePerms) {
        rows.push({
          role_template_id: tid,
          permission_key: p.permission_key,
          access_level: p.access_level,
        });
      }
    }
    if (rows.length) {
      await queryInterface.bulkInsert("access_role_template_permissions", rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("access_role_template_permissions", {
      role_template_id: {
        [queryInterface.sequelize.Sequelize.Op.in]: queryInterface.sequelize.literal(
          `(SELECT id FROM access_role_templates WHERE slug IN ('DAIRA_STANDARD','COMMUNE_STANDARD','DIRECTION_STANDARD'))`
        ),
      },
    }).catch(() => {});
    await queryInterface.bulkDelete("access_role_templates", {
      slug: ["DAIRA_STANDARD", "COMMUNE_STANDARD", "DIRECTION_STANDARD"],
    });
    await queryInterface.dropTable("workflow_role_settings");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_workflow_role_settings_role";');
    await queryInterface.removeColumn("users", "direction_id");
    await queryInterface.removeColumn("users", "municipality_id");
    await queryInterface.removeColumn("users", "daira_id");
    // ENUM values cannot be easily removed in Postgres — leave role/audience values.
  },
};
