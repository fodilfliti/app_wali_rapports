const { z } = require("zod");
const { V } = require("../errorKeys");

const choiceOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label_ar: z.string().trim().min(1).max(200),
  label_fr: z.string().trim().min(1).max(200)
});

const columnSchema = z.object({
  key: z.string().trim().min(1).max(80),
  type: z.enum(["text", "number", "date", "choice", "commune_ref", "formula"]),
  label_ar: z.string().trim().min(1).max(200),
  label_fr: z.string().trim().min(1).max(200),
  format: z.enum(["currency", "percent", "integer", "decimal"]).optional(),
  formula: z.string().max(500).optional(),
  footer_aggregate: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
  width: z.number().int().positive().optional(),
  merge_vertical_suggested: z.boolean().optional(),
  choices: z.array(choiceOptionSchema).optional()
});

const headerGroupSchema = z.object({
  label_ar: z.string().trim().min(1).max(200),
  label_fr: z.string().trim().min(1).max(200),
  column_keys: z.array(z.string().trim().min(1).max(80)).min(1)
});

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

const tableSchemaCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  name_ar: z.string().trim().min(1).max(200),
  name_fr: z.string().trim().min(1).max(200),
  service_id: z.number().int().positive().nullable().optional(),
  columns: z.array(columnSchema).min(1),
  layout_json: layoutJsonSchema
});

const tableSchemaPatchSchema = z.object({
  name_ar: z.string().trim().min(1).max(200).optional(),
  name_fr: z.string().trim().min(1).max(200).optional(),
  service_id: z.number().int().positive().nullable().optional(),
  columns: z.array(columnSchema).min(1).optional(),
  layout_json: layoutJsonSchema
});

const rapportTypeCreateSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/).optional(),
  name_ar: z.string().trim().min(1, V.rapportTitleRequired).max(200),
  name_fr: z.string().trim().min(1, V.rapportTitleRequired).max(200),
  content_kind: z.enum(["table_grid", "document_compose", "fiche_lecture", "commune_list"]),
  versioning_mode: z.enum(["versioned", "standalone"]).optional(),
  table_schema_slug: z.string().trim().max(80).optional(),
  table_key: z.string().trim().max(80).optional(),
  default_blocks: z.array(z.record(z.unknown())).optional()
});

const rapportTypePatchSchema = z.object({
  name_ar: z.string().trim().min(1).max(200).optional(),
  name_fr: z.string().trim().min(1).max(200).optional(),
  versioning_mode: z.enum(["versioned", "standalone"]).optional(),
  table_schema_slug: z.string().trim().max(80).optional(),
  table_key: z.string().trim().max(80).optional(),
  default_blocks: z.array(z.record(z.unknown())).optional()
});

module.exports = {
  tableSchemaCreateSchema,
  tableSchemaPatchSchema,
  rapportTypeCreateSchema,
  rapportTypePatchSchema
};
