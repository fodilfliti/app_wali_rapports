import { officeRapportWorkspacePath } from './rapportNavigation'

export type RapportPreviewSource = {
  id?: number
  service_id?: number
  rapport_type_id?: number
  rapportType?: { content_kind?: string }
}

export function versionsListPath(rapportId: number, wali: boolean, chef = false) {
  if (chef) return `/chef/rapports/${rapportId}/versions`
  return wali
    ? `/wali/rapports/${rapportId}/versions`
    : `/office/rapports/${rapportId}/versions`
}

export function versionDetailPath(
  rapportId: number,
  versionId: number,
  wali: boolean,
  chef = false,
) {
  if (chef) return `/chef/rapports/${rapportId}/versions/${versionId}`
  return wali
    ? `/wali/rapports/${rapportId}/versions/${versionId}`
    : `/office/rapports/${rapportId}/versions/${versionId}`
}

/** Stable read-only preview route — used for archive back navigation (avoids returnTo loops). */
export function rapportPreviewPath(
  rapportId: number,
  wali: boolean,
  rapport?: RapportPreviewSource | null,
  chef = false,
): string {
  if (chef) return `/chef/rapports/${rapportId}/view`
  if (wali) return `/wali/rapports/${rapportId}/view`

  if (rapport?.service_id && rapport?.rapport_type_id && rapport?.rapportType) {
    const workspace = officeRapportWorkspacePath({
      id: rapportId,
      service_id: rapport.service_id,
      rapport_type_id: rapport.rapport_type_id,
      rapportType: rapport.rapportType,
    })
    if (workspace) return workspace
  }

  return `/office/rapports/${rapportId}/document`
}
