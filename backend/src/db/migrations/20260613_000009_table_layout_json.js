"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("rapport_table_schemas", "layout_json", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null
    });

    const financeLayout = JSON.stringify({
      header_groups: [
        {
          label_ar: "الاعتمادات",
          label_fr: "Crédits",
          column_keys: ["credits_allocated", "credits_consumed", "consumption_pct"]
        }
      ]
    });

    await queryInterface.sequelize.query(
      `
      UPDATE rapport_table_schemas
      SET layout_json = :layout
      WHERE slug = 'finance-consommation-credits'
    `,
      { replacements: { layout: financeLayout } }
    );

    const investLayout = JSON.stringify({
      default_title_ar: "نتائج أشغال الخلية الولائية — متابعة تسوية المشاريع الاستثمارية",
      default_title_fr: "Résultats cellule wilaya — suivi des projets d'investissement",
      default_subtitle_ar: "",
      default_subtitle_fr: ""
    });

    const investCols = JSON.stringify([
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
        label_fr: "Commune",
        merge_vertical_suggested: true
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

    await queryInterface.sequelize.query(
      `
      UPDATE rapport_table_schemas
      SET layout_json = :layout,
          columns_json = :columns
      WHERE slug = 'investissement-projets'
    `,
      { replacements: { layout: investLayout, columns: investCols } }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("rapport_table_schemas", "layout_json");
  }
};
