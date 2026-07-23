import type { EntityIdParam } from '../api'
import { officeRapportWorkspacePath } from './rapportNavigation'

export type RapportPreviewSource = {
  id?: EntityIdParam
  service_id?: EntityIdParam
  rapport_type_id?: EntityIdParam
  rapportType?: { content_kind?: string }
}

export function versionsListPath(rapportId: EntityIdParam, wali: boolean, chef = false) {
  if (chef) return `/chief/rapports/${rapportId}/versions`
  return wali
    ? `/governor/rapports/${rapportId}/versions`
    : `/cabinet/rapports/${rapportId}/versions`
}

export function versionDetailPath(
  rapportId: EntityIdParam,
  versionId: EntityIdParam,
  wali: boolean,
  chef = false,
) {
  if (chef) return `/chief/rapports/${rapportId}/versions/${versionId}`
  return wali
    ? `/governor/rapports/${rapportId}/versions/${versionId}`
    : `/cabinet/rapports/${rapportId}/versions/${versionId}`
}

/** Stable read-only preview route — used for archive back navigation (avoids returnTo loops). */
export function rapportPreviewPath(
  rapportId: EntityIdParam,
  wali: boolean,
  rapport?: RapportPreviewSource | null,
  chef = false,
): string {
  if (chef) return `/chief/rapports/${rapportId}/view`
  if (wali) return `/governor/rapports/${rapportId}/view`

  if (rapport?.service_id && rapport?.rapport_type_id && rapport?.rapportType) {
    const workspace = officeRapportWorkspacePath({
      id: rapportId,
      service_id: rapport.service_id,
      rapport_type_id: rapport.rapport_type_id,
      rapportType: rapport.rapportType,
    })
    if (workspace) return workspace
  }

  return `/cabinet/rapports/${rapportId}/document`
}
