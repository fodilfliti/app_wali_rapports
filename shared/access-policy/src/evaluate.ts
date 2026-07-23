import type { ActionKey } from './actions';
import type { UserRole } from './roles';
import { ACTION_REQUIREMENTS, meetsMinAccessLevel } from './permissions';
import {
  canChefRespondFromList,
  canOfficeEditRapport,
  canOfficeReturnToDraft,
  canReviewerRespondFromList,
} from './policies/rapportStatus';
import {
  canExportExcel,
  canOfficeEditRapportKind,
  canShowVersionArchive,
  canShowWaliResponseExportBlock,
  canStartNewVersion,
  type ContentKind,
  type VersioningMode,
} from './policies/rapportByKind';

export type ActionContext = {
  role: UserRole;
  /** Effective permission levels from `/me` or resource payload. */
  effectivePermissions?: Record<string, string>;
  /** Resource-scoped access level (`none` | `view` | `manage`). */
  accessLevel?: string;
  status?: string;
  content_kind?: ContentKind;
  versioning_mode?: VersioningMode | string;
  commune_content_kind?: string | null;
};

function passesRequirement(ctx: ActionContext, action: ActionKey): boolean {
  const req = ACTION_REQUIREMENTS[action];
  if (!req) return false;

  if (req.roles && !req.roles.includes(ctx.role)) return false;

  if (req.permissionKey) {
    const level = ctx.effectivePermissions?.[req.permissionKey] ?? ctx.accessLevel;
    if (level === 'none') return false;
    if (!meetsMinAccessLevel(level, req.minAccessLevel)) return false;
  } else if (req.minAccessLevel && ctx.accessLevel) {
    if (!meetsMinAccessLevel(ctx.accessLevel, req.minAccessLevel)) return false;
  }

  return true;
}

/**
 * Evaluate whether an action is allowed given role, permissions, and resource context.
 * Kind/status helpers applied for rapport-scoped actions.
 */
export function canAction(ctx: ActionContext, action: ActionKey): boolean {
  if (!passesRequirement(ctx, action)) return false;

  const status = ctx.status ?? '';
  const kind = ctx.content_kind;

  switch (action) {
    case 'rapport.edit':
      if (!kind) return canOfficeEditRapport(status) && ctx.role === 'OFFICE_USER';
      return canOfficeEditRapportKind({
        content_kind: kind,
        status,
        accessLevel: ctx.accessLevel,
      });

    case 'rapport.return_to_draft':
      return ctx.role === 'OFFICE_USER' && canOfficeReturnToDraft(status);

    case 'rapport.start_new_version':
      if (!kind) return false;
      return (
        ctx.role === 'OFFICE_USER' &&
        canStartNewVersion({
          content_kind: kind,
          status,
          versioning_mode: ctx.versioning_mode,
        })
      );

    case 'rapport.show_version_archive':
      if (!kind) return false;
      return canShowVersionArchive({
        content_kind: kind,
        versioning_mode: ctx.versioning_mode,
      });

    case 'rapport.export_excel':
      if (!kind) return false;
      return ctx.role === 'OFFICE_USER' && canExportExcel({
        content_kind: kind,
        commune_content_kind: ctx.commune_content_kind,
      });

    case 'rapport.show_wali_response_export':
      if (!kind) return false;
      return ctx.role === 'WALI' && canShowWaliResponseExportBlock({ content_kind: kind });

    case 'rapport.respond':
      if (ctx.role === 'CHEF_CABINET') return canChefRespondFromList(status);
      if (ctx.role === 'WALI') return canReviewerRespondFromList(status);
      return false;

    case 'rapport.submit':
      return ctx.role === 'OFFICE_USER' && status === 'draft';

    case 'rapport.finish':
      return ctx.role === 'OFFICE_USER' && status !== 'draft';

    default:
      return true;
  }
}
