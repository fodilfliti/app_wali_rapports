import type { HubKey } from './segments'

/**
 * Legacy URL segment (first path segment) → stable hub key.
 * Canonical segments live in HUB_SEGMENTS (cabinet / chief / governor).
 */
export const LEGACY_HUB_ALIASES: Record<string, HubKey> = {
  office: 'office',
  wali: 'wali',
  chef: 'chef',
}

/** Legacy hub path prefixes (no trailing slash) for FE redirects / BE dual mounts. */
export const LEGACY_PATH_PREFIXES: readonly string[] = [
  '/office',
  '/wali',
  '/chef',
]

/** Legacy liste path segment (`…/communes`) — canonical is LISTE_PATH_SEGMENT (`entities`). */
export const LEGACY_LISTE_PATH_SEGMENT = 'communes'

/** Legacy API patch segment — canonical is LISTE_ENTITY_DATA_SEGMENT (`entity-data`). */
export const LEGACY_LISTE_ENTITY_DATA_SEGMENT = 'commune-data'
