const path = require("path");
const {
  canAction,
  canOfficeEditRapport,
  canOfficeReturnToDraft,
  canStartNewVersion,
  canShowVersionArchive,
  canExportExcel,
  canShowWaliResponseExportBlock,
  canOfficeEditRapportKind,
  isAwaitingChefResponse,
  isAwaitingWaliResponse,
  canChefRespondFromList,
  canReviewerRespondFromList,
} = require(path.join(__dirname, "../../../../shared/access-policy/dist"));

function forbidden(message = "Forbidden") {
  const err = new Error(message);
  err.status = 403;
  return err;
}

/**
 * Assert shared policy allows action. Throws 403 on denial.
 * @param {object} user — req.user (role, effectivePermissions, …)
 * @param {string} action — ActionKey
 * @param {object} [resource] — status, accessLevel, content_kind, versioning_mode, …
 */
function assertCan(user, action, resource = {}) {
  const ok = canAction(
    {
      role: user?.role,
      effectivePermissions: user?.effectivePermissions || user?.effective_permissions,
      accessLevel: resource.accessLevel,
      status: resource.status,
      content_kind: resource.content_kind,
      versioning_mode: resource.versioning_mode,
      commune_content_kind: resource.commune_content_kind,
    },
    action
  );
  if (!ok) throw forbidden();
  return true;
}

module.exports = {
  assertCan,
  canAction,
  canOfficeEditRapport,
  canOfficeReturnToDraft,
  canStartNewVersion,
  canShowVersionArchive,
  canExportExcel,
  canShowWaliResponseExportBlock,
  canOfficeEditRapportKind,
  isAwaitingChefResponse,
  isAwaitingWaliResponse,
  canChefRespondFromList,
  canReviewerRespondFromList,
  forbidden,
};
