const { z } = require("zod");
const { V } = require("../errorKeys");

const changeCodeSchema = z.object({
  current_code: z.string().min(1, V.required),
  new_code: z.string().trim().min(8, V.passwordMinLength).max(128, V.maxLength)
});

module.exports = { changeCodeSchema };
