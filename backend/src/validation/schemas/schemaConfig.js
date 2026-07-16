const { z } = require("zod");
const { V } = require("../errorKeys");
const {
  bilingualLabelShape,
  bilingualNameShape,
  refineBilingualLabels,
  refineBilingualNames
} = require("../bilingual");

const choiceOptionSchema = refineBilingualLabels(
  z.object({
    value: z.string().trim().min(1).max(80),
    ...bilingualLabelShape()
  })
);

const columnSchema = refineBilingualLabels(
  z.object({
    key: z.string().trim().min(1).max(80),
    type: z.enum(["text", "number", "date", "choice", "commune_ref", "formula"]),
    ...bilingualLabelShape(),
    format: z.enum(["currency", "percent", "integer", "decimal"]).optional(),
    formula: z.string().max(500).optional(),
    footer_aggregate: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
    width: z.number().int().positive().optional(),
    merge_vertical_suggested: z.boolean().optional(),
    choices: z.array(choiceOptionSchema).optional()
  })
);

const headerGroupSchema = refineBilingualLabels(
  z.object({
    ...bilingualLabelShape(),
    column_keys: z.array(z.string().trim().min(1).max(80)).min(1)
  })
);

const layoutJsonSchema = z
  .object({
    header_groups: z.array(headerGroupSchema).optional(),
    default_title_ar: z.string().max(500).optional(),
    default_title_fr: z.string().max(500).optional(),
    default_subtitle_ar: z.string().max(500).optional(),
    default_subtitle_fr: z.string().max(500).optional()
  })
  .nullable()
  .optional();

const tableSchemaCreateSchema = refineBilingualNames(
  z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    ...bilingualNameShape(),
    service_id: z.number().int().positive().nullable().optional(),
    columns: z.array(columnSchema).min(1),
    layout_json: layoutJsonSchema
  })
);

const tableSchemaPatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  service_id: z.number().int().positive().nullable().optional(),
  columns: z.array(columnSchema).min(1).optional(),
  layout_json: layoutJsonSchema
});

const rapportTypeCreateSchema = refineBilingualNames(
  z.object({
    slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/).optional(),
    ...bilingualNameShape(),
    content_kind: z.enum(["table_grid", "document_compose", "fiche_lecture", "commune_list"]),
    versioning_mode: z.enum(["versioned", "standalone"]).optional(),
    commune_content_kind: z.enum(["table", "complex"]).optional(),
    entity_target_kinds: z.array(z.enum(["commune", "daira", "modiriya"])).min(1).max(3).optional(),
    table_schema_slug: z.string().trim().max(80).optional(),
    table_key: z.string().trim().max(80).optional(),
    default_blocks: z.array(z.record(z.unknown())).optional()
  }),
  V.rapportTitleRequired
);

const rapportTypePatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  versioning_mode: z.enum(["versioned", "standalone"]).optional(),
  commune_content_kind: z.enum(["table", "complex"]).optional(),
  entity_target_kinds: z.array(z.enum(["commune", "daira", "modiriya"])).min(1).max(3).optional(),
  table_schema_slug: z.string().trim().max(80).optional(),
  table_key: z.string().trim().max(80).optional(),
  default_blocks: z.array(z.record(z.unknown())).optional()
});

const documentTemplateContentSchema = z.object({
  rich_html_ar: z.string().max(500000).optional(),
  rich_html_fr: z.string().max(500000).optional(),
  embedded_tables: z.array(z.record(z.unknown())).optional()
});

const documentTemplateCreateSchema = refineBilingualNames(
  z.object({
    slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
    ...bilingualNameShape(),
    rapport_type_id: z.number().int().positive().nullable().optional(),
    rapport_type_ids: z.array(z.number().int().positive()).max(50).optional(),
    content_kind: z.enum(["document_compose", "fiche_lecture"]).nullable().optional(),
    is_default: z.boolean().optional(),
    content_json: documentTemplateContentSchema.optional()
  })
);

const documentTemplatePatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  rapport_type_id: z.number().int().positive().nullable().optional(),
  rapport_type_ids: z.array(z.number().int().positive()).max(50).optional(),
  content_kind: z.enum(["document_compose", "fiche_lecture"]).nullable().optional(),
  is_default: z.boolean().optional(),
  content_json: documentTemplateContentSchema.optional()
});

const applyDocumentTemplateSchema = z.object({
  template_id: z.number().int().positive(),
  mode: z.enum(["replace", "append"]).optional()
});

module.exports = {
  tableSchemaCreateSchema,
  tableSchemaPatchSchema,
  rapportTypeCreateSchema,
  rapportTypePatchSchema,
  documentTemplateCreateSchema,
  documentTemplatePatchSchema,
  applyDocumentTemplateSchema
};
