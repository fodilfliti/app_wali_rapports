export type HubKey = 'admin' | 'office' | 'chef' | 'wali'

/** Editable URL segments — change here to rename hubs. */
export const HUB_SEGMENTS: Record<HubKey, string> = {
  admin: 'admin',
  office: 'cabinet',
  chef: 'chief',
  wali: 'governor',
}

/** Target English segments (for P3 rename). Export as TARGET_HUB_SEGMENTS. */
export const TARGET_HUB_SEGMENTS: Record<HubKey, string> = {
  admin: 'admin',
  office: 'cabinet',
  chef: 'chief',
  wali: 'governor',
}

/**
 * Office liste (`commune_list`) UI/API path segment.
 * Internal content_kind stays `commune_list`; public paths use this segment.
 */
export const LISTE_PATH_SEGMENT = 'entities'

/** API body patch path for one liste entity (under `/rapports/:id/`). */
export const LISTE_ENTITY_DATA_SEGMENT = 'entity-data'
