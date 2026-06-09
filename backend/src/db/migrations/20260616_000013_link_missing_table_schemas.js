"use strict";

/** Link table_grid / commune_list rapport types missing table_schema_slug to the first service schema. */
module.exports = {
  async up(queryInterface) {
    const [types] = await queryInterface.sequelize.query(`
      SELECT rt.id, rt.service_id
      FROM rapport_types rt
      WHERE rt.content_kind IN ('table_grid', 'commune_list')
        AND (
          rt.schema_json IS NULL
          OR rt.schema_json->>'table_schema_slug' IS NULL
          OR rt.schema_json->>'table_schema_slug' = ''
        )
    `);

    for (const row of types) {
      let slug = null;
      const [serviceSchemas] = await queryInterface.sequelize.query(
        `
        SELECT slug FROM rapport_table_schemas
        WHERE service_id = :serviceId
        ORDER BY id ASC
        LIMIT 1
      `,
        { replacements: { serviceId: row.service_id } }
      );
      if (serviceSchemas[0]?.slug) {
        slug = serviceSchemas[0].slug;
      } else {
        const [sharedSchemas] = await queryInterface.sequelize.query(`
          SELECT slug FROM rapport_table_schemas
          WHERE service_id IS NULL
          ORDER BY id ASC
          LIMIT 1
        `);
        if (sharedSchemas[0]?.slug) slug = sharedSchemas[0].slug;
      }
      if (!slug) continue;

      const schemaJson = JSON.stringify({ table_schema_slug: slug, table_key: "main" });
      await queryInterface.sequelize.query(
        `
        UPDATE rapport_types
        SET schema_json = :schemaJson::jsonb
        WHERE id = :id
      `,
        { replacements: { id: row.id, schemaJson } }
      );
    }
  },

  async down() {
    // Data repair migration — no automatic rollback.
  }
};
