export const ENTITY_TARGET_KINDS = ['commune', 'daira', 'modiriya'] as const

export type EntityTargetKind = (typeof ENTITY_TARGET_KINDS)[number]

export function defaultEntityTargetKinds(): EntityTargetKind[] {
  return ['commune']
}

export function normalizeEntityTargetKinds(raw: unknown): EntityTargetKind[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  const filtered = arr.filter((k): k is EntityTargetKind =>
    ENTITY_TARGET_KINDS.includes(k as EntityTargetKind),
  )
  return filtered.length ? [...new Set(filtered)] : defaultEntityTargetKinds()
}

export function toggleEntityTargetKind(
  kinds: EntityTargetKind[],
  kind: EntityTargetKind,
): EntityTargetKind[] {
  if (kinds.includes(kind)) {
    const next = kinds.filter((k) => k !== kind)
    return next.length ? next : kinds
  }
  return [...kinds, kind]
}

/** Singular unit word for list hub progress/search, based on active kinds. */
export function listEntityUnitKey(kinds: unknown): string {
  const arr = normalizeEntityTargetKinds(kinds)
  if (arr.length === 1) {
    if (arr[0] === 'commune') return 'listUnit_commune'
    if (arr[0] === 'daira') return 'listUnit_daira'
    if (arr[0] === 'modiriya') return 'listUnit_modiriya'
  }
  return 'listUnit_mixed'
}
