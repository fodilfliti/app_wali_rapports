const { z } = require("zod");
const { V } = require("../errorKeys");

const changeCodeSchema = z.object({
  current_code: z.string().min(1, V.required),
  new_code: z.string().trim().min(8, V.passwordMinLength).max(128, V.maxLength)
});

/** Self-service profile: name required; job_title optional (null/empty clears). */
const profilePatchSchema = z.object({
  name: z.string().trim().min(1, V.userNameRequired).max(255, V.maxLength),
  job_title: z.string().trim().max(120, V.maxLength).nullable().optional(),
});

const notificationPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  rapport_inbox: z.boolean().optional(),
  rapport_feedback: z.boolean().optional(),
  discussion: z.boolean().optional(),
  instructions: z.boolean().optional(),
  broadcasts: z.boolean().optional(),
  calendar: z.boolean().optional(),
});

const pushSubscribeSchema = z.object({
  endpoint: z.string().trim().min(1, V.required).max(2000, V.maxLength),
  keys: z.object({
    p256dh: z.string().trim().min(1, V.required).max(255, V.maxLength),
    auth: z.string().trim().min(1, V.required).max(255, V.maxLength),
  }),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1, V.required).max(2000, V.maxLength),
});

module.exports = {
  changeCodeSchema,
  profilePatchSchema,
  notificationPrefsSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
};
