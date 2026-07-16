import { latestSubmittedVersion } from './rapportNavigation'

type ResponseWithVersion = {
  rapport_version_id?: number | string | null
}

/** Keep only remarks tied to one version (Number compare avoids string mismatch). */
export function filterResponsesByVersionId<T extends ResponseWithVersion>(
  responses: T[] | null | undefined,
  versionId: number | string | null | undefined,
): T[] {
  const vid = Number(versionId)
  if (!Number.isFinite(vid) || vid <= 0) return []
  return (responses || []).filter(
    (r) => Number(r.rapport_version_id) === vid,
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
  versions: { id: number; version_number: number; submitted_at?: string | null }[] = [],
  allResponses: ResponseWithVersion[] = [],
): number | null {
  const currentId = Number(rapport?.current_version_id)
  if (!Number.isFinite(currentId) || currentId <= 0) return null

  const onCurrent = filterResponsesByVersionId(allResponses, currentId)
  if (onCurrent.length) return currentId

  if (rapport?.status === 'changes_requested') {
    const submitted = latestSubmittedVersion(versions)
    if (submitted?.id) return Number(submitted.id)
  }

  return currentId
}
