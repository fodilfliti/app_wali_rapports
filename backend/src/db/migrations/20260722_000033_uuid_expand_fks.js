"use strict";

/**
 * UUID expand step 2: parallel *_uuid FK columns for core relations.
 * Requires 20260722_000032 (uuid columns on parent tables) already applied.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addUuidFk = async (table, column) => {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) return;
      await queryInterface.addColumn(table, column, {
        type: Sequelize.UUID,
        allowNull: true,
      });
    };

    await addUuidFk("rapports", "created_by_user_uuid");
    await addUuidFk("rapports", "owner_office_user_uuid");
    await addUuidFk("rapports", "rapport_type_uuid");
    await addUuidFk("rapports", "current_version_uuid");
    await addUuidFk("rapport_versions", "rapport_uuid");
    await addUuidFk("rapport_versions", "created_by_user_uuid");
    await addUuidFk("user_service_grants", "user_uuid");
    await addUuidFk("user_service_grants", "service_uuid");
    await addUuidFk("uploaded_files", "rapport_uuid");
    await addUuidFk("notifications", "rapport_uuid");
    await addUuidFk("notifications", "user_uuid");
    await addUuidFk("rapport_comments", "rapport_uuid");
    await addUuidFk("rapport_comments", "author_user_uuid");

    // Backfill from BIGINT joins
    await queryInterface.sequelize.query(`
      UPDATE rapports r
      SET created_by_user_uuid = u.uuid
      FROM users u
      WHERE r.created_by_user_id = u.id AND r.created_by_user_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapports r
      SET owner_office_user_uuid = u.uuid
      FROM users u
      WHERE r.owner_office_user_id = u.id AND r.owner_office_user_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapports r
      SET rapport_type_uuid = rt.uuid
      FROM rapport_types rt
      WHERE r.rapport_type_id = rt.id AND r.rapport_type_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapports r
      SET current_version_uuid = v.uuid
      FROM rapport_versions v
      WHERE r.current_version_id = v.id AND r.current_version_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_versions v
      SET rapport_uuid = r.uuid
      FROM rapports r
      WHERE v.rapport_id = r.id AND v.rapport_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_versions v
      SET created_by_user_uuid = u.uuid
      FROM users u
      WHERE v.created_by_user_id = u.id AND v.created_by_user_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE user_service_grants g
      SET user_uuid = u.uuid
      FROM users u
      WHERE g.user_id = u.id AND g.user_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE user_service_grants g
      SET service_uuid = s.uuid
      FROM services s
      WHERE g.service_id = s.id AND g.service_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE uploaded_files f
      SET rapport_uuid = r.uuid
      FROM rapports r
      WHERE f.rapport_id = r.id AND f.rapport_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE notifications n
      SET rapport_uuid = r.uuid
      FROM rapports r
      WHERE n.rapport_id = r.id AND n.rapport_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE notifications n
      SET user_uuid = u.uuid
      FROM users u
      WHERE n.user_id = u.id AND n.user_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_comments c
      SET rapport_uuid = r.uuid
      FROM rapports r
      WHERE c.rapport_id = r.id AND c.rapport_uuid IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE rapport_comments c
      SET author_user_uuid = u.uuid
      FROM users u
      WHERE c.author_user_id = u.id AND c.author_user_uuid IS NULL
    `);
  },

  async down(queryInterface) {
    const cols = [
      ["rapports", "created_by_user_uuid"],
      ["rapports", "owner_office_user_uuid"],
      ["rapports", "rapport_type_uuid"],
      ["rapports", "current_version_uuid"],
      ["rapport_versions", "rapport_uuid"],
      ["rapport_versions", "created_by_user_uuid"],
      ["user_service_grants", "user_uuid"],
      ["user_service_grants", "service_uuid"],
      ["uploaded_files", "rapport_uuid"],
      ["notifications", "rapport_uuid"],
      ["notifications", "user_uuid"],
      ["rapport_comments", "rapport_uuid"],
      ["rapport_comments", "author_user_uuid"],
    ];
    for (const [table, column] of cols) {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) await queryInterface.removeColumn(table, column);
    }
  },
};
