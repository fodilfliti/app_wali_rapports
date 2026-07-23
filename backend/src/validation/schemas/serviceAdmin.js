const { z } = require("zod");
const { bilingualNameShape, refineBilingualNames } = require("../bilingual");
const { publicEntityIdSchema } = require("../publicEntityId");

const serviceCreateSchema = refineBilingualNames(
  z.object({
    department_id: publicEntityIdSchema.nullable().optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    ...bilingualNameShape(),
    sort_order: z.number().int().min(0).optional(),
    is_folder: z.boolean().optional(),
    parent_service_id: publicEntityIdSchema.nullable().optional()
  })
);

const servicePatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  department_id: publicEntityIdSchema.nullable().optional()
});

const serviceGrantsSchema = z.object({
  grants: z.array(
    z.object({
      user_id: publicEntityIdSchema,
      access_level: z.enum(["view", "manage"])
    })
  )
});

const departmentCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(),
    sort_order: z.number().int().min(0).optional()
  })
);

const departmentPatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional()
});

module.exports = {
  serviceCreateSchema,
  servicePatchSchema,
  serviceGrantsSchema,
  departmentCreateSchema,
  departmentPatchSchema
};
