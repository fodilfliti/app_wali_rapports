"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = JSON.stringify([
      {
        key: "project_title",
        type: "text",
        label_ar: "عنوان المشروع",
        label_fr: "Intitulé du projet"
      },
      {
        key: "owner",
        type: "text",
        label_ar: "صاحب المشروع",
        label_fr: "Maître d'ouvrage"
      },
      {
        key: "municipality_code",
        type: "commune_ref",
        label_ar: "البلدية",
        label_fr: "Commune"
      },
      {
        key: "location",
        type: "text",
        label_ar: "موقع المشروع",
        label_fr: "Localisation"
      },
      {
        key: "total_amount_kdzd",
        type: "number",
        format: "currency",
        label_ar: "المبلغ الإجمالي (دج)",
        label_fr: "Montant total (DA)"
      },
      {
        key: "completion_pct",
        type: "number",
        format: "percent",
        label_ar: "نسبة الإنجاز",
        label_fr: "Taux d'avancement"
      },
      { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" }
    ]);

    await queryInterface.bulkInsert("rapport_table_schemas", [
      {
        service_id: null,
        slug: "investissement-projets",
        name_ar: "جدول تسوية المشاريع الاستثمارية",
        name_fr: "Grille tsuie projets investissement",
        columns_json: columns,
        is_system: true
      }
    ]);

    await queryInterface.sequelize.query(`
      UPDATE rapport_types
      SET content_kind = 'table_grid',
          schema_json = '{"table_schema_slug":"investissement-projets","table_key":"main"}'
      WHERE slug = 'investissement_grid'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE rapport_types SET schema_json = '{"module":"RAPPORT_INVESTISSEMENT"}' WHERE slug = 'investissement_grid'
    `);
    await queryInterface.bulkDelete("rapport_table_schemas", { slug: "investissement-projets" }, {});
  }
};
