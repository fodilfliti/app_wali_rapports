const { z } = require("zod");
const { V } = require("../errorKeys");
const {
  bilingualNameShape,
  refineBilingualNames,
  refineBilingualPair,
  hasBilingualText
} = require("../bilingual");

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

const municipalityCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(255),
    code: z
      .string()
      .trim()
      .min(1, V.municipalityCodeRequired)
      .max(32, V.maxLength)
      .regex(/^\d+$/, V.municipalityCodeDigitsOnly),
    daira_id: z.number().int().positive({ message: V.dairaRequired })
  })
);

const municipalityPatchSchema = z
  .object({
    name_ar: z.string().trim().max(255, V.maxLength).optional(),
    name_fr: z.string().trim().max(255, V.maxLength).optional(),
    code: z
      .string()
      .trim()
      .min(1, V.municipalityCodeRequired)
      .max(32, V.maxLength)
      .regex(/^\d+$/, V.municipalityCodeDigitsOnly)
      .optional(),
    daira_id: z.number().int().positive().optional()
  })
  .superRefine((data, ctx) => {
    if (data.name_ar !== undefined || data.name_fr !== undefined) {
      if (!hasBilingualText(data.name_ar, data.name_fr)) {
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_ar"] });
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_fr"] });
      }
    }
  });

const dairaCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(255),
    code: z.string().trim().min(1, V.codeRequired).max(50, V.maxLength)
  })
);

const dairaPatchSchema = z
  .object({
    name_ar: z.string().trim().max(255, V.maxLength).optional(),
    name_fr: z.string().trim().max(255, V.maxLength).optional(),
    code: z.string().trim().min(1, V.codeRequired).max(50, V.maxLength).optional()
  })
  .superRefine((data, ctx) => {
    if (data.name_ar !== undefined || data.name_fr !== undefined) {
      if (!hasBilingualText(data.name_ar, data.name_fr)) {
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_ar"] });
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_fr"] });
      }
    }
  });

const directionCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(255),
    code: z.string().trim().max(50, V.maxLength).optional()
  })
);
const directionPatchSchema = dairaPatchSchema;

const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, V.usernameRequired)
    .max(120, V.maxLength)
    .refine((s) => USERNAME_RE.test(s), V.errorUsernameFormat),
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  role: z.enum(["ADMIN", "OFFICE_USER", "CHEF_CABINET", "WALI"], {
    errorMap: () => ({ message: V.userRoleInvalid })
  }),
  department_id: z.number().int().positive().nullable().optional(),
  job_title: z.string().trim().max(120, V.maxLength).nullable().optional()
});

const userPatchSchema = z.object({
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength).optional(),
  department_id: z.number().int().positive().nullable().optional(),
  job_title: z.string().trim().max(120, V.maxLength).nullable().optional()
});

const rapportCreateSchema = z.object({
  service_id: z.coerce.number().int().positive(),
  rapport_type_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, V.rapportTitleRequired).max(500, V.maxLength),
  reference_date: z.string().nullable().optional(),
  data_json: z.record(z.unknown()).optional()
});

const rapportPatchSchema = z.object({
  title: z.string().trim().min(1, V.rapportTitleRequired).max(500, V.maxLength).optional(),
  reference_date: z.string().nullable().optional(),
  data_json: z.record(z.unknown()).optional()
});

const waliRespondSchema = z
  .object({
    decision: z.enum(["accepted", "changes_requested", "viewed"], {
      errorMap: () => ({ message: V.waliDecisionInvalid })
    }),
    follow_up_status: z.enum(["none", "pending", "completed"]).optional(),
    body_text: z.string().trim().max(10000, V.maxLength).optional()
  })
  .superRefine((data, ctx) => {
    if (data.decision === "changes_requested" && !data.body_text?.trim()) {
      ctx.addIssue({ code: "custom", message: V.waliResponseRequired, path: ["body_text"] });
    }
    if (data.decision !== "accepted" && data.follow_up_status && data.follow_up_status !== "none") {
      ctx.addIssue({ code: "custom", message: V.waliFollowUpInvalid, path: ["follow_up_status"] });
    }
  });

const rapportCommentSchema = z.object({
  body_text: z.string().trim().min(1, V.required).max(5000, V.maxLength)
});

/** null = reset to all entities of the rapport type's target kinds */
const includedEntitiesSchema = z.object({
  keys: z.union([z.array(z.string().trim().min(1).max(64)).max(500), z.null()]),
});

const guideAudienceEnum = z.enum(["general", "ADMIN", "OFFICE_USER", "CHEF_CABINET", "WALI"], {
  errorMap: () => ({ message: V.required })
});

const guideVideoCreateSchema = refineBilingualPair(
  z.object({
    title_ar: z.string().trim().max(200, V.maxLength).optional().default(""),
    title_fr: z.string().trim().max(200, V.maxLength).optional().default(""),
    description_ar: z.string().trim().max(5000, V.maxLength).nullable().optional(),
    description_fr: z.string().trim().max(5000, V.maxLength).nullable().optional(),
    audience: guideAudienceEnum,
    is_new: z.boolean().optional().default(false),
    sort_order: z.number().int().min(0).max(99999).optional().default(0)
  }),
  "title_ar",
  "title_fr"
);

const guideVideoPatchSchema = z
  .object({
    title_ar: z.string().trim().max(200, V.maxLength).optional(),
    title_fr: z.string().trim().max(200, V.maxLength).optional(),
    description_ar: z.string().trim().max(5000, V.maxLength).nullable().optional(),
    description_fr: z.string().trim().max(5000, V.maxLength).nullable().optional(),
    audience: guideAudienceEnum.optional(),
    is_new: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(99999).optional()
  })
  .superRefine((data, ctx) => {
    if (data.title_ar !== undefined || data.title_fr !== undefined) {
      if (!hasBilingualText(data.title_ar, data.title_fr)) {
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["title_ar"] });
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["title_fr"] });
      }
    }
  });

module.exports = {
  municipalityCreateSchema,
  municipalityPatchSchema,
  dairaCreateSchema,
  dairaPatchSchema,
  directionCreateSchema,
  directionPatchSchema,
  userCreateSchema,
  userPatchSchema,
  rapportCreateSchema,
  rapportPatchSchema,
  waliRespondSchema,
  rapportCommentSchema,
  includedEntitiesSchema,
  guideVideoCreateSchema,
  guideVideoPatchSchema,
};
