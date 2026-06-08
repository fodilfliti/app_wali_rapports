"use strict";

/** Demo example seeds only — Finance/Hydraulique samples, not fixed domain modules. */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const financeCols = JSON.stringify([
      {
        key: "municipality_code",
        type: "commune_ref",
        label_ar: "البلدية",
        label_fr: "Commune",
        width: 120
      },
      {
        key: "credits_allocated",
        type: "number",
        format: "currency",
        label_ar: "الاعتمادات المالية (دج)",
        label_fr: "Crédits alloués (DA)"
      },
      {
        key: "credits_consumed",
        type: "number",
        format: "currency",
        label_ar: "المبلغ المستهلك (دج)",
        label_fr: "Montant consommé (DA)"
      },
      {
        key: "consumption_pct",
        type: "formula",
        formula: "credits_allocated > 0 ? (credits_consumed / credits_allocated) * 100 : 0",
        format: "percent",
        label_ar: "نسبة الاستهلاك",
        label_fr: "Taux de consommation"
      },
      { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" }
    ]);

    await queryInterface.bulkInsert("rapport_table_schemas", [
      {
        service_id: null,
        slug: "finance-consommation-credits",
        name_ar: "نسبة استهلاك الاعتمادات",
        name_fr: "Taux de consommation des crédits",
        columns_json: financeCols,
        is_system: true
      }
    ]);

    const [banqueRows] = await queryInterface.sequelize.query(
      `SELECT id FROM services WHERE slug = 'finance-banque' LIMIT 1`
    );
    const [hydRows] = await queryInterface.sequelize.query(
      `SELECT id FROM services WHERE slug = 'hydraulique' LIMIT 1`
    );

    if (banqueRows.length) {
      await queryInterface.bulkInsert("rapport_types", [
        {
          service_id: banqueRows[0].id,
          slug: "consommation_credits",
          name_ar: "نسبة استهلاك الاعتمادات",
          name_fr: "Consommation des crédits",
          layout_kind: "grid",
          content_kind: "table_grid",
          versioning_mode: "versioned",
          schema_json: JSON.stringify({ table_schema_slug: "finance-consommation-credits", table_key: "main" })
        }
      ]);
    }

    if (hydRows.length) {
      await queryInterface.bulkInsert("rapport_types", [
        {
          service_id: hydRows[0].id,
          slug: "etat_barrages",
          name_ar: "حالة السدود",
          name_fr: "État des barrages",
          layout_kind: "memo",
          content_kind: "document_compose",
          versioning_mode: "standalone",
          schema_json: JSON.stringify({
            default_blocks: [
              {
                type: "heading",
                align: "center",
                bold: true,
                text_ar: "حالة السدود",
                text_fr: "État des barrages"
              },
              {
                type: "paragraph",
                text_ar: "ملخص الوضعية الحالية للسدود على مستوى الولاية.",
                text_fr: "Synthèse de la situation des barrages au niveau de la wilaya."
              }
            ]
          })
        },
        {
          service_id: hydRows[0].id,
          slug: "distribution_eau",
          name_ar: "برنامج التوزيع",
          name_fr: "Programme de distribution",
          layout_kind: "memo",
          content_kind: "document_compose",
          versioning_mode: "standalone",
          schema_json: JSON.stringify({
            default_blocks: [
              {
                type: "heading",
                align: "center",
                bold: true,
                text_ar: "برنامج توزيع المياه",
                text_fr: "Programme de distribution d'eau"
              },
              { type: "paragraph", text_ar: "", text_fr: "" }
            ]
          })
        }
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("rapport_types", { slug: "consommation_credits" }, {});
    await queryInterface.bulkDelete("rapport_types", { slug: "etat_barrages" }, {});
    await queryInterface.bulkDelete("rapport_types", { slug: "distribution_eau" }, {});
    await queryInterface.bulkDelete("rapport_table_schemas", { slug: "finance-consommation-credits" }, {});
  }
};
