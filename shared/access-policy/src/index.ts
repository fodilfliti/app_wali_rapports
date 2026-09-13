// Roles & ids
export type { UserRole, HubKey, CreatorKey } from './roles';
export {
  ROLE_LABEL_KEYS,
  CREATOR_HUB_LABEL_KEYS,
  CREATOR_ROLES,
  CREATOR_KEYS,
  CREATOR_KEY_TO_ROLE,
  CREATOR_ROLE_TO_KEY,
  ORG_HEAD_CREATOR_ROLES,
  ORG_HEAD_FEATURE_FLAGS,
  hubKeyForRole,
  isCreatorRole,
  isOrgHeadCreatorRole,
  hidesCommuneListContentKind,
  hidesFicheLectureContentKind,
  blocksOrgHeadReturnToDraft,
  usesChefNotificationsWording,
  chefChannelNavLabelKey,
  creatorKeyFromRole,
  roleFromCreatorKey,
} from './roles';

export type { EntityId } from './ids';
export { entityIdSchema } from './ids';

// Actions & permissions
export type { ActionKey } from './actions';

export type { AccessLevel, PermissionDef, ActionRequirement } from './permissions';
export {
  PERMISSIONS,
  PERMISSION_KEYS,
  ACTION_REQUIREMENTS,
  levelRank,
  meetsMinAccessLevel,
} from './permissions';

// Rapport status policies
export {
  canOfficeEditRapport,
  canOfficeReturnToDraft,
  isAwaitingWaliResponse,
  isAwaitingChefResponse,
  isAwaitingReviewerResponse,
  canReviewerRespondFromList,
  canChefRespondFromList,
} from './policies/rapportStatus';

// Rapport kind policies
export type { ContentKind, VersioningMode, RapportKindContext } from './policies/rapportByKind';
export {
  canStartNewVersion,
  canShowVersionArchive,
  canExportExcel,
  canShowWaliResponseExportBlock,
  canOfficeEditRapportKind,
} from './policies/rapportByKind';

// Hub policies
export type { HubTileDef, ResolveHubTilesOpts } from './policies/hub';
export { resolveHubTiles, canShowHubTile } from './policies/hub';

// Evaluation
export type { ActionContext } from './evaluate';
export { canAction } from './evaluate';

// Workflow tree scaffold
export type { WorkflowLevelKind, WorkflowLevel, WorkflowTree } from './workflowTree';
export {
  WILAYA_DEFAULT_TREE,
  DIRECTION_EXAMPLE_3_LEVEL,
  DIRECTION_EXAMPLE_2_LEVEL,
} from './workflowTree';
