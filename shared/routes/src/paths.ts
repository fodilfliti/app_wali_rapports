import {
  HUB_SEGMENTS,
  LISTE_ENTITY_DATA_SEGMENT,
  LISTE_PATH_SEGMENT,
  type HubKey,
} from './segments'

export function hubHome(key: HubKey): string {
  return `/${HUB_SEGMENTS[key]}`
}

export function hubPath(key: HubKey, ...parts: string[]): string {
  const base = hubHome(key)
  if (parts.length === 0) return base
  const suffix = parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return suffix ? `${base}/${suffix}` : base
}

/** Express API router mount path (under apiBase, e.g. `/office`). */
export function apiMount(key: HubKey): string {
  return `/${HUB_SEGMENTS[key]}`
}

/** Office liste hub: `/cabinet/services/:serviceId/entities`. */
export function officeListeHubPath(serviceId: string): string {
  return hubPath('office', 'services', serviceId, LISTE_PATH_SEGMENT)
}

/** Office liste entity editor: `/cabinet/services/:serviceId/entities/:entityKey`. */
export function officeListeEntityPath(serviceId: string, entityKey: string): string {
  return hubPath(
    'office',
    'services',
    serviceId,
    LISTE_PATH_SEGMENT,
    encodeURIComponent(entityKey),
  )
}

/** Office liste bulk editor: `/cabinet/services/:serviceId/entities/bulk`. */
export function officeListeBulkPath(serviceId: string): string {
  return hubPath('office', 'services', serviceId, LISTE_PATH_SEGMENT, 'bulk')
}

/** API path under office mount: `rapports/:id/entities/:entityKey`. */
export function apiListeEntityPath(rapportId: string, entityKey: string): string {
  return `rapports/${rapportId}/${LISTE_PATH_SEGMENT}/${encodeURIComponent(entityKey)}`
}

/** API path under office mount: `rapports/:id/entities/:entityKey/clear`. */
export function apiListeEntityClearPath(rapportId: string, entityKey: string): string {
  return `${apiListeEntityPath(rapportId, entityKey)}/clear`
}

/** API path under office mount: `rapports/:id/entity-data`. */
export function apiListeEntityDataPath(rapportId: string): string {
  return `rapports/${rapportId}/${LISTE_ENTITY_DATA_SEGMENT}`
}

const ROLE_TO_HUB: Record<string, HubKey> = {
  ADMIN: 'admin',
  OFFICE_USER: 'office',
  CHEF_CABINET: 'chef',
  WALI: 'wali',
}

export function hubKeyFromRole(role: string): HubKey | null {
  return ROLE_TO_HUB[role] ?? null
}

export function roleToHubKey(role: string): HubKey | null {
  return hubKeyFromRole(role)
}

export const paths = {
  hub: {
    home: hubHome,
    path: hubPath,
    liste: {
      hub: officeListeHubPath,
      entity: officeListeEntityPath,
      bulk: officeListeBulkPath,
    },
  },
  api: {
    mount: apiMount,
    liste: {
      entity: apiListeEntityPath,
      entityClear: apiListeEntityClearPath,
      entityData: apiListeEntityDataPath,
    },
  },
}
