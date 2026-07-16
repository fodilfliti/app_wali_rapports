/** Prefixed entity keys for commune_list data_json — mirrors backend entityKeys.js */

import {
  ENTITY_TARGET_KINDS,
  type EntityTargetKind,
} from './entityTargets'

export type ParsedEntityKey = {
  kind: EntityTargetKind
  code: string
}

export function entityKey(kind: EntityTargetKind, code: string): string {
  return `${kind}:${code}`
}

export function parseEntityKey(key: string | null | undefined): ParsedEntityKey | null {
  if (!key || typeof key !== 'string') return null
  if (key.includes(':')) {
    const [kind, ...rest] = key.split(':')
    if (!ENTITY_TARGET_KINDS.includes(kind as EntityTargetKind)) return null
    return { kind: kind as EntityTargetKind, code: rest.join(':') }
  }
  // Legacy bare commune code
  return { kind: 'commune', code: key }
}

export function ensureEntitiesMap<T extends Record<string, unknown>>(
  dataJson: T | null | undefined,
): T & { entities: Record<string, unknown>; communes: Record<string, unknown> } {
  const data = (
    dataJson && typeof dataJson === 'object' ? { ...dataJson } : {}
  ) as T & { entities?: Record<string, unknown>; communes?: Record<string, unknown> }

  const communes =
    data.communes && typeof data.communes === 'object' ? { ...data.communes } : {}

  if (data.entities && typeof data.entities === 'object') {
    const entities = { ...data.entities }
    // Dual-fill: legacy communes not yet mirrored into entities
    for (const [code, val] of Object.entries(communes)) {
      const key = entityKey('commune', code)
      if (!(key in entities)) entities[key] = val
    }
    return { ...data, entities, communes }
  }

  const entities: Record<string, unknown> = {}
  for (const [code, val] of Object.entries(communes)) {
    entities[entityKey('commune', code)] = val
  }
  return { ...data, entities, communes }
}

export function getEntitiesMap(
  dataJson: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return ensureEntitiesMap(dataJson).entities || {}
}

/** Resolve entity content by prefixed key with legacy bare-code fallback. */
export function getEntityEntry(
  entities: Record<string, unknown> | null | undefined,
  communes: Record<string, unknown> | null | undefined,
  entityKeyOrCode: string,
): unknown {
  if (entities && entityKeyOrCode in entities) return entities[entityKeyOrCode]
  const parsed = parseEntityKey(entityKeyOrCode)
  if (!parsed) return undefined
  const prefixed = entityKey(parsed.kind, parsed.code)
  if (entities && prefixed in entities) return entities[prefixed]
  if (communes && parsed.code in communes) return communes[parsed.code]
  if (communes && entityKeyOrCode in communes) return communes[entityKeyOrCode]
  return undefined
}
