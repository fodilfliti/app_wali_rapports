"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE rapport_types
      SET slug = 'fiche_lecture',
          name_ar = 'بطاقة مطالعة',
          name_fr = 'Fiche lecture',
          content_kind = 'fiche_lecture',
          versioning_mode = 'standalone'
      WHERE slug = 'fiche_lecture_wilaya'
    `);

    const [leafServices] = await queryInterface.sequelize.query(`
      SELECT s.id
      FROM services s
      WHERE s.is_active = true AND s.is_folder = false
    `);

    for (const row of leafServices) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM rapport_types WHERE service_id = ${row.id} AND content_kind = 'fiche_lecture' LIMIT 1`
      );
      if (existing.length) continue;

      await queryInterface.bulkInsert("rapport_types", [
        {
          service_id: row.id,
          slug: "fiche_lecture",
          name_ar: "بطاقة مطالعة",
          name_fr: "Fiche lecture",
          layout_kind: "memo",
          content_kind: "fiche_lecture",
          versioning_mode: "standalone",
          schema_json: JSON.stringify({
            default_blocks: [
              {
                type: "heading",
                align: "center",
                bold: true,
                text_ar: "بطاقة مطالعة",
                text_fr: "Fiche lecture"
              },
              { type: "paragraph", text_ar: "", text_fr: "" }
            ]
          })
        }
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("rapport_types", { slug: "fiche_lecture", content_kind: "fiche_lecture" }, {});
  }
};
