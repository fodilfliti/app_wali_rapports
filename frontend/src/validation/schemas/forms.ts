import { z } from 'zod'
import { V } from '../messages'
import { hasBilingualText } from '../../utils/bilingual'

const USERNAME_RE = /^[A-Za-z0-9_]+$/

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
  role: z.enum(['ADMIN', 'OFFICE_USER', 'WALI'], { message: V.userRoleInvalid }),
  job_title: z.string().trim().max(120, V.maxLength).optional(),
})

export const userPatchFormSchema = z.object({
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  job_title: z.string().trim().max(120, V.maxLength).optional(),
})

export const rapportCreateSchema = z.object({
  service_id: z.number().int().positive(),
  rapport_type_id: z.number().int().positive(),
  title: z.string().trim().min(1, V.rapportTitleRequired).max(500, V.maxLength),
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
