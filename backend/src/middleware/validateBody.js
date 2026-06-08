const { V } = require("../validation/errorKeys");

function zodIssuesToFieldErrors(issues) {
  const fieldErrors = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (parsed.success) {
      req.validatedBody = parsed.data;
      return next();
    }
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      fieldErrors: zodIssuesToFieldErrors(parsed.error.issues),
      requestId: req.requestId
    });
  };
}

module.exports = { validateBody, zodIssuesToFieldErrors, V };
