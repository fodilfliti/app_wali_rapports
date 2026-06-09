"use strict";

/** Rename fiche_lecture Arabic label: بطاقة مطالعة → مذكرة استخلاصية */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE rapport_types
      SET name_ar = 'مذكرة استخلاصية'
      WHERE content_kind = 'fiche_lecture'
        AND (name_ar = 'بطاقة مطالعة' OR name_ar IS NULL OR name_ar = '')
    `);

    await queryInterface.sequelize.query(`
      UPDATE rapport_types
      SET schema_json = jsonb_set(
        schema_json,
        '{default_blocks,0,text_ar}',
        '"مذكرة استخلاصية"',
        true
      )
      WHERE content_kind = 'fiche_lecture'
        AND schema_json->'default_blocks'->0->>'text_ar' = 'بطاقة مطالعة'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE rapport_types
      SET name_ar = 'بطاقة مطالعة'
      WHERE content_kind = 'fiche_lecture' AND name_ar = 'مذكرة استخلاصية'
    `);
  }
};
