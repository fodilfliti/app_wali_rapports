import { z } from 'zod'
import { V } from '../messages'
import { hasBilingualText } from '../../utils/bilingual'

const USERNAME_RE = /^[A-Za-z0-9_]+$/

/** Public entity id: UUID, legacy digit string, or positive number (transition). */
const publicEntityIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^\d+$/),
  z.coerce.number().int().positive(),
])

export const municipalityFormSchema = z
  .object({
    name_ar: z.string().trim().max(255, V.maxLength),
    name_fr: z.string().trim().max(255, V.maxLength),
    code: z
      .string()
      .trim()
      .min(1, V.municipalityCodeRequired)
      .max(32, V.maxLength)
      .regex(/^\d+$/, V.municipalityCodeDigitsOnly),
    daira_id: publicEntityIdSchema,
  })
  .superRefine((data, ctx) => {
    if (!hasBilingualText(data.name_ar, data.name_fr)) {
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_ar'] })
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_fr'] })
    }
  })

const orgCodeSchema = z
  .string()
  .trim()
  .min(1, V.codeRequired)
  .max(32, V.maxLength)

const orgNameSchema = z
  .object({
    name_ar: z.string().trim().max(255, V.maxLength),
    name_fr: z.string().trim().max(255, V.maxLength),
    code: orgCodeSchema,
  })
  .superRefine((data, ctx) => {
    if (!hasBilingualText(data.name_ar, data.name_fr)) {
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_ar'] })
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_fr'] })
    }
  })

export const dairaFormSchema = orgNameSchema

/** Direction UI no longer collects code; server/frontend auto-assigns on create. */
export const directionFormSchema = z
  .object({
    name_ar: z.string().trim().max(255, V.maxLength),
    name_fr: z.string().trim().max(255, V.maxLength),
    code: z.string().trim().max(32, V.maxLength).optional(),
  })
  .superRefine((data, ctx) => {
    if (!hasBilingualText(data.name_ar, data.name_fr)) {
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_ar'] })
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['name_fr'] })
    }
  })

export const userFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, V.usernameRequired)
    .max(120, V.maxLength)
    .refine((s) => USERNAME_RE.test(s), V.errorUsernameFormat),
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  role: z.enum(['ADMIN', 'OFFICE_USER', 'CHEF_CABINET', 'WALI'], { message: V.userRoleInvalid }),
  job_title: z.string().trim().max(120, V.maxLength).optional(),
})

export const userPatchFormSchema = z.object({
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  job_title: z.string().trim().max(120, V.maxLength).optional(),
})

export const rapportCreateSchema = z.object({
  service_id: publicEntityIdSchema,
  rapport_type_id: publicEntityIdSchema,
  title: z.string().trim().min(1, V.rapportTitleRequired).max(500, V.maxLength),
})

export const guideVideoFormSchema = z
  .object({
    title_ar: z.string().trim().max(200, V.maxLength),
    title_fr: z.string().trim().max(200, V.maxLength),
    description_ar: z.string().trim().max(5000, V.maxLength).optional(),
    description_fr: z.string().trim().max(5000, V.maxLength).optional(),
    audience: z.enum(['general', 'ADMIN', 'OFFICE_USER', 'CHEF_CABINET', 'WALI'], {
      message: V.required,
    }),
    is_new: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!hasBilingualText(data.title_ar, data.title_fr)) {
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['title_ar'] })
      ctx.addIssue({ code: 'custom', message: V.bilingualLabelRequired, path: ['title_fr'] })
    }
  })

export const waliRespondSchema = z.object({
  decision: z.enum(['accepted', 'changes_requested', 'viewed'], { message: V.waliDecisionInvalid }),
  follow_up_status: z.enum(['none', 'pending', 'completed']).optional(),
  body_text: z.string().trim().max(10000, V.maxLength).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'changes_requested' && !data.body_text?.trim()) {
    ctx.addIssue({ code: 'custom', message: V.waliResponseRequired, path: ['body_text'] })
  }
  if (data.decision !== 'accepted' && data.follow_up_status && data.follow_up_status !== 'none') {
    ctx.addIssue({ code: 'custom', message: V.waliFollowUpInvalid, path: ['follow_up_status'] })
  }
})
