const { z } = require("zod");
const { bilingualNameShape, refineBilingualNames } = require("../bilingual");
const { publicEntityIdSchema } = require("../publicEntityId");

const orgScopeEnum = z.enum(["diwan", "daira", "commune", "direction"]);

const serviceCreateSchema = refineBilingualNames(
  z
    .object({
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
      parent_service_id: publicEntityIdSchema.nullable().optional(),
      org_scope: orgScopeEnum.optional().default("diwan"),
      /** Public UUIDs of dairas / municipalities / directions; empty = all active of that type. */
      org_unit_ids: z.array(publicEntityIdSchema).optional(),
      /** When true with non-diwan leaf, create for every active unit (ignores org_unit_ids). */
      org_units_all: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      const scope = data.org_scope || "diwan";
      const isFolder = data.is_folder === true;
      if (isFolder && scope !== "diwan" && Array.isArray(data.org_unit_ids) && data.org_unit_ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["org_unit_ids"],
          message: "foldersHaveNoOrgUnits",
        });
      }
      if (!isFolder && scope === "diwan" && Array.isArray(data.org_unit_ids) && data.org_unit_ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["org_unit_ids"],
          message: "diwanHasNoOrgUnits",
        });
      }
    })
);

const servicePatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  department_id: publicEntityIdSchema.nullable().optional(),
});

const serviceGrantsSchema = z.object({
  grants: z.array(
    z.object({
      user_id: publicEntityIdSchema,
      access_level: z.enum(["view", "manage"]),
    })
  ),
});

const departmentCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(),
    sort_order: z.number().int().min(0).optional(),
  })
);

const departmentPatchSchema = z.object({
  name_ar: z.string().trim().max(200).optional(),
  name_fr: z.string().trim().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

module.exports = {
  serviceCreateSchema,
  servicePatchSchema,
  serviceGrantsSchema,
  departmentCreateSchema,
  departmentPatchSchema,
  orgScopeEnum,
};
