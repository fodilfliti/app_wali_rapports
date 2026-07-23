import type { EntityIdParam } from '../api'

/** Normalize route/query/API ids without coercing UUIDs via Number(). */
export function asEntityId(value: unknown): EntityIdParam | undefined {
  if (value == null || value === '') return undefined
  return String(value) as EntityIdParam
}

/** Compare public entity ids (UUID or digit string / number). */
export function entityIdsEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null || a === '' || b === '') return false
  return String(a) === String(b)
}
