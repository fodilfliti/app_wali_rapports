/** Account roles — DB/JWT enum values (not UI labels). */
export type UserRole = 'ADMIN' | 'OFFICE_USER' | 'CHEF_CABINET' | 'WALI';

/** Stable hub keys — independent of URL segment renames. */
export type HubKey = 'admin' | 'office' | 'chef' | 'wali';

/** i18n keys for role display labels (Arabic default UI). */
export const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  ADMIN: 'roleAdmin',
  OFFICE_USER: 'roleOfficeUser',
  CHEF_CABINET: 'roleChefCabinet',
  WALI: 'roleWali',
};

export function hubKeyForRole(role: UserRole): HubKey {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'OFFICE_USER':
      return 'office';
    case 'CHEF_CABINET':
      return 'chef';
    case 'WALI':
      return 'wali';
  }
}
