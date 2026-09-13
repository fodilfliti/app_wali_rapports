/** Account roles — DB/JWT enum values (not UI labels). */
export type UserRole =
  | 'ADMIN'
  | 'OFFICE_USER'
  | 'CHEF_CABINET'
  | 'WALI'
  | 'PRESIDENT_DAIRA'
  | 'PRESIDENT_COMMUNE'
  | 'DIRECTEUR_DIRECTION';

/** Stable hub keys — independent of URL segment renames. */
export type HubKey = 'admin' | 'office' | 'chef' | 'wali';

/**
 * Short URL segment for Wali/Chef creator navigation (`/governor/creators/:key`).
 * Path rename ≠ role rename.
 */
export type CreatorKey = 'office' | 'daira' | 'commune' | 'direction';

/** Creator (cabinet) roles — same `/cabinet` hub as OFFICE_USER. */
export const CREATOR_ROLES: readonly UserRole[] = [
  'OFFICE_USER',
  'PRESIDENT_DAIRA',
  'PRESIDENT_COMMUNE',
  'DIRECTEUR_DIRECTION',
] as const;

export const CREATOR_KEYS: readonly CreatorKey[] = [
  'office',
  'daira',
  'commune',
  'direction',
] as const;

export const CREATOR_KEY_TO_ROLE: Record<CreatorKey, UserRole> = {
  office: 'OFFICE_USER',
  daira: 'PRESIDENT_DAIRA',
  commune: 'PRESIDENT_COMMUNE',
  direction: 'DIRECTEUR_DIRECTION',
};

export const CREATOR_ROLE_TO_KEY: Partial<Record<UserRole, CreatorKey>> = {
  OFFICE_USER: 'office',
  PRESIDENT_DAIRA: 'daira',
  PRESIDENT_COMMUNE: 'commune',
  DIRECTEUR_DIRECTION: 'direction',
};

/** Creator roles that are org-scoped heads (not attachés). */
export const ORG_HEAD_CREATOR_ROLES: readonly UserRole[] = [
  'PRESIDENT_DAIRA',
  'PRESIDENT_COMMUNE',
  'DIRECTEUR_DIRECTION',
] as const;

/**
 * Flip any flag to `false` to re-enable that capability for org-head creators
 * without hunting call sites.
 *
 * Chef channel UI: org heads use إشعارات; ملحق بالديوان + رئيس الديوان + Wali keep تعليمات
 * when `chefChannelAsNotifications` is true (see `usesChefNotificationsWording`).
 */
export const ORG_HEAD_FEATURE_FLAGS = {
  /** Hide قائمة (commune_list) for org-head creators. */
  hideCommuneList: true,
  /** Hide مذكرة استخلاصية (fiche_lecture) for org-head creators. */
  hideFicheLecture: true,
  /**
   * Block «return to draft» after send (pending_chef / submitted / under_review).
   * Edit remains allowed only in `draft` and `changes_requested` (Wali/Chef demand).
   */
  blockReturnToDraft: true,
  /**
   * When true: org-head UIs use إشعارات / Notifications for the Chef channel.
   * OFFICE_USER, CHEF_CABINET, and Wali always keep تعليمات.
   */
  chefChannelAsNotifications: true,
} as const;

export function isOrgHeadCreatorRole(role: string | null | undefined): boolean {
  return (
    role === 'PRESIDENT_DAIRA' ||
    role === 'PRESIDENT_COMMUNE' ||
    role === 'DIRECTEUR_DIRECTION'
  );
}

/** قائمة — silent omit for org-head creators when flag on. */
export function hidesCommuneListContentKind(role: string | null | undefined): boolean {
  return ORG_HEAD_FEATURE_FLAGS.hideCommuneList && isOrgHeadCreatorRole(role);
}

/** مذكرة استخلاصية — silent omit for org-head creators when flag on. */
export function hidesFicheLectureContentKind(role: string | null | undefined): boolean {
  return ORG_HEAD_FEATURE_FLAGS.hideFicheLecture && isOrgHeadCreatorRole(role);
}

/** True when role must not recall a sent rapport to draft. */
export function blocksOrgHeadReturnToDraft(role: string | null | undefined): boolean {
  return ORG_HEAD_FEATURE_FLAGS.blockReturnToDraft && isOrgHeadCreatorRole(role);
}

/**
 * Chef channel wording: إشعارات for org heads only;
 * تعليمات for ملحق بالديوان, رئيس الديوان, Wali, etc.
 */
export function usesChefNotificationsWording(role: string | null | undefined): boolean {
  if (!ORG_HEAD_FEATURE_FLAGS.chefChannelAsNotifications) return false;
  return isOrgHeadCreatorRole(role);
}

/** i18n nav/hub title key for the Chef→creators channel. */
export function chefChannelNavLabelKey(role?: string | null): string {
  return usesChefNotificationsWording(role) ? 'navChefNotifications' : 'navChefInstructions';
}

export function isCreatorRole(role: string | null | undefined): boolean {
  return (
    role === 'OFFICE_USER' ||
    role === 'PRESIDENT_DAIRA' ||
    role === 'PRESIDENT_COMMUNE' ||
    role === 'DIRECTEUR_DIRECTION'
  );
}

export function creatorKeyFromRole(role: string): CreatorKey | null {
  return (CREATOR_ROLE_TO_KEY as Record<string, CreatorKey | undefined>)[role] ?? null;
}

export function roleFromCreatorKey(key: string): UserRole | null {
  return (CREATOR_KEY_TO_ROLE as Record<string, UserRole | undefined>)[key] ?? null;
}

/** i18n keys for role display labels (Arabic default UI). */
export const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  ADMIN: 'roleAdmin',
  OFFICE_USER: 'roleOfficeUser',
  CHEF_CABINET: 'roleChefCabinet',
  WALI: 'roleWali',
  PRESIDENT_DAIRA: 'rolePresidentDaira',
  PRESIDENT_COMMUNE: 'rolePresidentCommune',
  DIRECTEUR_DIRECTION: 'roleDirecteurDirection',
};

/** i18n keys for Wali/Chef creator hub cards (plural groups). */
export const CREATOR_HUB_LABEL_KEYS: Record<CreatorKey, string> = {
  office: 'navCreatorsOffice',
  daira: 'navCreatorsDaira',
  commune: 'navCreatorsCommune',
  direction: 'navCreatorsDirection',
};

export function hubKeyForRole(role: UserRole): HubKey {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'OFFICE_USER':
    case 'PRESIDENT_DAIRA':
    case 'PRESIDENT_COMMUNE':
    case 'DIRECTEUR_DIRECTION':
      return 'office';
    case 'CHEF_CABINET':
      return 'chef';
    case 'WALI':
      return 'wali';
  }
}
