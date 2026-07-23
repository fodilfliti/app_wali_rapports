import { latestSubmittedVersion } from './rapportNavigation'
import type { EntityIdParam } from '../api'
import { entityIdsEqual } from './entityIds'

type ResponseWithVersion = {
  rapport_version_id?: number | string | null
}

/** Keep only remarks tied to one version (string compare — UUID-safe). */
export function filterResponsesByVersionId<T extends ResponseWithVersion>(
  responses: T[] | null | undefined,
  versionId: number | string | null | undefined,
): T[] {
  if (versionId == null || versionId === '') return []
  return (responses || []).filter((r) =>
    entityIdsEqual(r.rapport_version_id, versionId),
  )
}

/**
 * Version id whose Chef/Wali notes should appear on live edit/preview/inbox.
 * Prefer current_version_id when it has remarks; after changes_requested draft fork,
 * fall back to the latest submitted snapshot (where the review notes live).
 */
export function activeRemarksVersionId(
  rapport: {
    current_version_id?: number | string | null
    status?: string | null
  } | null | undefined,
  versions: { id: EntityIdParam; version_number: number; submitted_at?: string | null }[] = [],
  allResponses: ResponseWithVersion[] = [],
): EntityIdParam | null {
  const currentId = rapport?.current_version_id
  if (currentId == null || currentId === '') return null

  const onCurrent = filterResponsesByVersionId(allResponses, currentId)
  if (onCurrent.length) return currentId as EntityIdParam

  if (rapport?.status === 'changes_requested') {
    const submitted = latestSubmittedVersion(versions)
    if (submitted?.id != null) return submitted.id as EntityIdParam
  }

  return currentId as EntityIdParam
}
