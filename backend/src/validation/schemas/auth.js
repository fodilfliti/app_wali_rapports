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

module.exports = { changeCodeSchema, profilePatchSchema };
