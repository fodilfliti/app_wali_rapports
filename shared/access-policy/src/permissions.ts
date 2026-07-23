import type { ActionKey } from './actions';
import type { UserRole } from './roles';

/** Access levels from permission catalog (`none` | `view` | `manage`). */
export type AccessLevel = 'none' | 'view' | 'manage';

/** Permission catalog entry shape (mirrors backend permissionCatalog.js). */
export type PermissionDef = {
  key: string;
  scope: 'both' | 'admin' | 'office' | 'wali' | 'chef';
  module: string;
  label_fr: string;
  label_ar: string;
};

/** Catalog keys — mirror of backend PERMISSIONS. */
export const PERMISSIONS: PermissionDef[] = [
  { key: 'hub.dashboard', scope: 'both', module: 'hub', label_fr: 'Tableau de bord', label_ar: 'لوحة التحكم' },
  { key: 'organization.municipalities.view', scope: 'admin', module: 'organization', label_fr: 'Communes — consulter', label_ar: 'البلديات — عرض' },
  { key: 'organization.municipalities.manage', scope: 'admin', module: 'organization', label_fr: 'Communes — gérer', label_ar: 'البلديات — إدارة' },
  { key: 'organization.users.view', scope: 'admin', module: 'organization', label_fr: 'Utilisateurs — consulter', label_ar: 'المستخدمون — عرض' },
  { key: 'organization.users.manage', scope: 'admin', module: 'organization', label_fr: 'Utilisateurs — gérer', label_ar: 'المستخدمون — إدارة' },
  { key: 'organization.access_roles.manage', scope: 'admin', module: 'organization', label_fr: "Profils d'accès — gérer", label_ar: 'ملفات الوصول — إدارة' },
  { key: 'rapports.investissement.view', scope: 'office', module: 'rapports', label_fr: 'Investissement — consulter', label_ar: 'الاستثمار — عرض' },
  { key: 'rapports.investissement.manage', scope: 'office', module: 'rapports', label_fr: 'Investissement — gérer', label_ar: 'الاستثمار — إدارة' },
  { key: 'rapports.investissement.export', scope: 'office', module: 'rapports', label_fr: 'Investissement — exporter', label_ar: 'الاستثمار — تصدير' },
  { key: 'rapports.finance.view', scope: 'office', module: 'rapports', label_fr: 'Finance — consulter', label_ar: 'المالية — عرض' },
  { key: 'rapports.finance.manage', scope: 'office', module: 'rapports', label_fr: 'Finance — gérer', label_ar: 'المالية — إدارة' },
  { key: 'rapports.finance.export', scope: 'office', module: 'rapports', label_fr: 'Finance — exporter', label_ar: 'المالية — تصدير' },
  { key: 'rapports.hydraulique.view', scope: 'office', module: 'rapports', label_fr: 'Hydraulique — consulter', label_ar: 'الموارد المائية — عرض' },
  { key: 'rapports.hydraulique.manage', scope: 'office', module: 'rapports', label_fr: 'Hydraulique — gérer', label_ar: 'الموارد المائية — إدارة' },
  { key: 'rapports.hydraulique.export', scope: 'office', module: 'rapports', label_fr: 'Hydraulique — exporter', label_ar: 'الموارد المائية — تصدير' },
  { key: 'rapports.inbox.view', scope: 'wali', module: 'rapports', label_fr: 'Boîte de réception — consulter', label_ar: 'الوارد — عرض' },
  { key: 'rapports.inbox.respond', scope: 'wali', module: 'rapports', label_fr: 'Boîte de réception — répondre', label_ar: 'الوارد — الرد' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export type ActionRequirement = {
  /** Permission catalog key (when grants/templates apply). */
  permissionKey?: string;
  /** Minimum access level on `permissionKey`. */
  minAccessLevel?: AccessLevel;
  /** Coarse role gate (hub shell / actions without catalog key). */
  roles?: UserRole[];
};

/**
 * Bridge: ActionKey → permission requirements.
 * UI/BE evaluate via `canAction`; catalog keys remain runtime control surface.
 */
export const ACTION_REQUIREMENTS: Partial<Record<ActionKey, ActionRequirement>> = {
  // Admin hub
  'hub.admin.municipalities': { roles: ['ADMIN'], permissionKey: 'organization.municipalities.view', minAccessLevel: 'view' },
  'hub.admin.dairas': { roles: ['ADMIN'] },
  'hub.admin.directions': { roles: ['ADMIN'] },
  'hub.admin.users': { roles: ['ADMIN'], permissionKey: 'organization.users.view', minAccessLevel: 'view' },
  'hub.admin.rapports': { roles: ['ADMIN'] },
  'hub.admin.services': { roles: ['ADMIN'] },
  'hub.admin.schemas': { roles: ['ADMIN'] },
  'hub.admin.guide': { roles: ['ADMIN'] },
  'hub.admin.access': { roles: ['ADMIN'], permissionKey: 'organization.access_roles.manage', minAccessLevel: 'view' },
  // Office hub
  'hub.office.services': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.rapports': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.discussion': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.notifications': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.shared': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.instructions': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  'hub.office.guide': { roles: ['OFFICE_USER'], permissionKey: 'hub.dashboard', minAccessLevel: 'view' },
  // Wali hub
  'hub.wali.office_users': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.inbox': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.discussion': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.calendar': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.shared': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.instructions': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.wali.guide': { roles: ['WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  // Chef hub
  'hub.chef.office_users': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.inbox': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.delete_requested': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.discussion': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.calendar': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.instructions': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.shared': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'hub.chef.guide': { roles: ['CHEF_CABINET'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  // Rapport actions
  'rapport.view': { roles: ['ADMIN', 'OFFICE_USER', 'CHEF_CABINET', 'WALI'] },
  'rapport.edit': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.submit': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.return_to_draft': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.start_new_version': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.show_version_archive': { roles: ['ADMIN', 'OFFICE_USER', 'CHEF_CABINET', 'WALI'] },
  'rapport.export_excel': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.show_wali_response_export': { roles: ['WALI'] },
  'rapport.respond': { roles: ['CHEF_CABINET', 'WALI'], permissionKey: 'rapports.inbox.respond', minAccessLevel: 'manage' },
  'rapport.comment': { roles: ['OFFICE_USER', 'CHEF_CABINET', 'WALI'] },
  'rapport.delete': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.finish': { roles: ['OFFICE_USER'], minAccessLevel: 'manage' },
  'rapport.discussion.view': { roles: ['OFFICE_USER', 'CHEF_CABINET', 'WALI'] },
  // Organization
  'organization.municipalities.view': { roles: ['ADMIN'], permissionKey: 'organization.municipalities.view', minAccessLevel: 'view' },
  'organization.municipalities.manage': { roles: ['ADMIN'], permissionKey: 'organization.municipalities.manage', minAccessLevel: 'manage' },
  'organization.users.view': { roles: ['ADMIN'], permissionKey: 'organization.users.view', minAccessLevel: 'view' },
  'organization.users.manage': { roles: ['ADMIN'], permissionKey: 'organization.users.manage', minAccessLevel: 'manage' },
  'organization.access_roles.manage': { roles: ['ADMIN'], permissionKey: 'organization.access_roles.manage', minAccessLevel: 'manage' },
  // Inbox / instructions
  'rapports.inbox.view': { roles: ['CHEF_CABINET', 'WALI'], permissionKey: 'rapports.inbox.view', minAccessLevel: 'view' },
  'rapports.inbox.respond': { roles: ['CHEF_CABINET', 'WALI'], permissionKey: 'rapports.inbox.respond', minAccessLevel: 'manage' },
  'rapports.instructions.view': { roles: ['OFFICE_USER', 'CHEF_CABINET', 'WALI'] },
  'rapports.instructions.create': { roles: ['WALI'] },
  'rapports.instructions.delete': { roles: ['WALI'] },
  'broadcast.create': { roles: ['WALI'] },
};

/** Rank access levels for comparison. */
export function levelRank(level: AccessLevel | string | undefined): number {
  if (level === 'manage') return 2;
  if (level === 'view') return 1;
  return 0;
}

export function meetsMinAccessLevel(
  actual: AccessLevel | string | undefined,
  required: AccessLevel | undefined,
): boolean {
  if (!required) return true;
  return levelRank(actual) >= levelRank(required);
}
