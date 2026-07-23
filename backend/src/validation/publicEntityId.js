const { z } = require("zod");

/** Public entity id: UUID, legacy digit string, or positive number (transition). */
const publicEntityIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^\d+$/),
  z.coerce.number().int().positive(),
]);

module.exports = { publicEntityIdSchema };
