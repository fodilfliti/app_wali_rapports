const { z } = require("zod");

const serviceCreateSchema = z.object({
  department_id: z.number().int().positive(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  name_ar: z.string().trim().min(1).max(200),
  name_fr: z.string().trim().min(1).max(200),
  sort_order: z.number().int().min(0).optional(),
  is_folder: z.boolean().optional(),
  parent_service_id: z.number().int().positive().nullable().optional()
});

const servicePatchSchema = z.object({
  name_ar: z.string().trim().min(1).max(200).optional(),
  name_fr: z.string().trim().min(1).max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  department_id: z.number().int().positive().optional()
});

const serviceGrantsSchema = z.object({
  grants: z.array(
    z.object({
      user_id: z.coerce.number().int().positive(),
      access_level: z.enum(["view", "manage"])
    })
  )
});

const departmentCreateSchema = z.object({
  name_ar: z.string().trim().min(1).max(200),
  name_fr: z.string().trim().min(1).max(200),
  sort_order: z.number().int().min(0).optional()
});

const departmentPatchSchema = z.object({
  name_ar: z.string().trim().min(1).max(200).optional(),
  name_fr: z.string().trim().min(1).max(200).optional(),
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
