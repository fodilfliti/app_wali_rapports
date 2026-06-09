const { z } = require("zod");
const { V } = require("../errorKeys");
const { bilingualNameShape, refineBilingualNames, hasBilingualText } = require("../bilingual");

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

const municipalityCreateSchema = refineBilingualNames(
  z.object({
    ...bilingualNameShape(255),
    code: z
      .string()
      .trim()
      .min(1, V.municipalityCodeRequired)
      .max(32, V.maxLength)
      .regex(/^\d+$/, V.municipalityCodeDigitsOnly)
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
      .optional()
  })
  .superRefine((data, ctx) => {
    if (data.name_ar !== undefined || data.name_fr !== undefined) {
      if (!hasBilingualText(data.name_ar, data.name_fr)) {
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_ar"] });
        ctx.addIssue({ code: "custom", message: V.bilingualLabelRequired, path: ["name_fr"] });
      }
    }
  });

const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, V.usernameRequired)
    .max(120, V.maxLength)
    .refine((s) => USERNAME_RE.test(s), V.errorUsernameFormat),
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  role: z.enum(["ADMIN", "OFFICE_USER", "WALI"], { errorMap: () => ({ message: V.userRoleInvalid }) }),
  department_id: z.number().int().positive().nullable().optional(),
  job_title: z.string().trim().max(120, V.maxLength).nullable().optional()
});

const userPatchSchema = z.object({
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength).optional(),
  department_id: z.number().int().positive().nullable().optional(),
  job_title: z.string().trim().max(120, V.maxLength).nullable().optional()
});

const rapportCreateSchema = z.object({
  service_id: z.number().int().positive(),
  rapport_type_id: z.number().int().positive(),
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

module.exports = {
  municipalityCreateSchema,
  municipalityPatchSchema,
  userCreateSchema,
  userPatchSchema,
  rapportCreateSchema,
  rapportPatchSchema,
  waliRespondSchema
};
