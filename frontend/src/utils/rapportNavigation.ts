import type { HubIconName } from '../components/HubIcons'

export type RapportTypeNav = {
  id: number
  name_ar?: string
  name_fr?: string
  content_kind: string
  action_count?: number
  hidden_at?: string | null
}

const FICHE_LECTURE_AR = 'مذكرة استخلاصية'

/** Hub tile order: fiche → document → table → communes. */
export const CONTENT_KIND_DISPLAY_ORDER: Record<string, number> = {
  fiche_lecture: 0,
  document_compose: 1,
  table_grid: 2,
  commune_list: 3,
}

export const CONTENT_KINDS_ORDER = [
  'fiche_lecture',
  'document_compose',
  'table_grid',
  'commune_list',
] as const

export function contentKindHubIcon(contentKind: string): HubIconName {
  return rapportTypeHubIcon(contentKind)
}

export function officeContentKindPath(serviceId: number, contentKind: string) {
  return `/office/services/${serviceId}/kinds/${contentKind}`
}

export function waliContentKindPath(userId: number, serviceId: number, contentKind: string) {
  return `/wali/office-users/${userId}/services/${serviceId}/kinds/${contentKind}`
}

export function sortRapportTypesForDisplay(types: RapportTypeNav[], locale: string): RapportTypeNav[] {
  return [...types].sort((a, b) => {
    const orderA = CONTENT_KIND_DISPLAY_ORDER[a.content_kind] ?? 99
    const orderB = CONTENT_KIND_DISPLAY_ORDER[b.content_kind] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return localizedRapportTypeName(a, locale).localeCompare(localizedRapportTypeName(b, locale), locale)
  })
}

export function localizedRapportTypeName(rt: RapportTypeNav, locale: string) {
  if (rt.content_kind === 'fiche_lecture') {
    return locale === 'fr' ? rt.name_fr || 'Fiche lecture' : FICHE_LECTURE_AR
  }
  return locale === 'fr' ? rt.name_fr || rt.name_ar || '' : rt.name_ar || rt.name_fr || ''
}

export function rapportTypeHubIcon(contentKind: string): HubIconName {
  if (contentKind === 'table_grid') return 'table'
  if (contentKind === 'commune_list') return 'communes'
  if (contentKind === 'fiche_lecture') return 'fiche'
  if (contentKind === 'document_compose') return 'document'
  return 'rapports'
}

export function officeServiceHubPath(serviceId: number) {
  return `/office/services/${serviceId}`
}

export function officeRapportTypeListPath(serviceId: number, rapportTypeId: number) {
  return `/office/services/${serviceId}/rapports/${rapportTypeId}`
}

export function officeRapportTypePath(serviceId: number, rt: RapportTypeNav) {
  return officeRapportTypeListPath(serviceId, rt.id)
}

export function officeRapportTypeWorkspacePath(
  serviceId: number,
  rt: RapportTypeNav,
  rapportId?: number,
) {
  const q = new URLSearchParams({ rapport_type_id: String(rt.id) })
  if (rapportId) q.set('rapport_id', String(rapportId))
  const qs = q.toString()
  switch (rt.content_kind) {
    case 'table_grid':
      return `/office/services/${serviceId}/table?${qs}`
    case 'commune_list':
      return `/office/services/${serviceId}/communes?${qs}`
    case 'fiche_lecture':
      return rapportId
        ? `/office/rapports/${rapportId}/document`
        : `/office/services/${serviceId}/fiches?${qs}`
    case 'document_compose':
      return rapportId
        ? `/office/rapports/${rapportId}/document`
        : `/office/services/${serviceId}/documents?${qs}`
    default:
      return officeRapportTypeListPath(serviceId, rt.id)
  }
}

export function waliRapportTypeListPath(userId: number, serviceId: number, rt: RapportTypeNav) {
  return `/wali/office-users/${userId}/services/${serviceId}/rapports/${rt.id}`
}

export function canOfficeEditRapport(status: string) {
  return status === 'draft' || status === 'changes_requested'
}

export function isAwaitingWaliResponse(status: string) {
  return status === 'submitted' || status === 'under_review'
}

/** Archived version UI for versioned types once at least one snapshot was submitted. */
export function supportsRapportVersionArchive(
  rapportType?: { versioning_mode?: string } | null,
  versions: { submitted_at?: string | null }[] = [],
) {
  return (
    rapportType?.versioning_mode === 'versioned' &&
    versions.some((v) => v.submitted_at)
  )
}

export function latestSubmittedVersion<
  T extends { version_number: number; submitted_at?: string | null },
>(versions: T[]): T | undefined {
  return [...versions]
    .filter((v) => v.submitted_at)
    .sort((a, b) => b.version_number - a.version_number)[0]
}

/** Soft-hide (finish) — not deleted from DB. Drafts must be submitted first. */
export function canFinishRapport(status: string) {
  return status !== 'draft'
}

export function officeRapportWorkspacePath(r: {
  id: number
  service_id?: number
  rapport_type_id?: number
  rapportType?: { content_kind?: string }
}) {
  const kind = r.rapportType?.content_kind
  const sid = r.service_id
  const typeId = r.rapport_type_id

  if (kind === 'fiche_lecture' || kind === 'document_compose') {
    return `/office/rapports/${r.id}/document`
  }

  if (!sid) return null

  const q = new URLSearchParams()
  if (typeId) q.set('rapport_type_id', String(typeId))
  q.set('rapport_id', String(r.id))
  const qs = q.toString()

  if (kind === 'table_grid') return `/office/services/${sid}/table?${qs}`
  if (kind === 'commune_list') return `/office/services/${sid}/communes?${qs}`

  return null
}

export function isDirectWorkspaceKind(contentKind: string) {
  return contentKind === 'table_grid' || contentKind === 'commune_list'
}

export function officeCommuneEditorPath(
  serviceId: number,
  municipalityCode: string,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams()
  if (opts?.rapportTypeId) q.set('rapport_type_id', String(opts.rapportTypeId))
  if (opts?.rapportId) q.set('rapport_id', String(opts.rapportId))
  const qs = q.toString()
  return `/office/services/${serviceId}/communes/${encodeURIComponent(municipalityCode)}${qs ? `?${qs}` : ''}`
}

export function officeCommuneBulkPath(
  serviceId: number,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams()
  if (opts?.rapportTypeId) q.set('rapport_type_id', String(opts.rapportTypeId))
  if (opts?.rapportId) q.set('rapport_id', String(opts.rapportId))
  const qs = q.toString()
  return `/office/services/${serviceId}/communes/bulk${qs ? `?${qs}` : ''}`
}

/** Flatten grouped contentKinds when rapportTypes is missing (older API). */
export function rapportTypesFromHub(hub: {
  rapportTypes?: RapportTypeNav[]
  contentKinds?: Record<string, RapportTypeNav[]>
}): RapportTypeNav[] {
  if (hub.rapportTypes?.length) return hub.rapportTypes
  if (!hub.contentKinds) return []
  return Object.values(hub.contentKinds).flat().filter((t) => t?.id)
}

export function rapportTypesForContentKind(
  hub: {
    rapportTypes?: RapportTypeNav[]
    contentKinds?: Record<string, RapportTypeNav[]>
  },
  contentKind: string,
): RapportTypeNav[] {
  const fromGroup = hub.contentKinds?.[contentKind]
  if (fromGroup?.length) return fromGroup
  return rapportTypesFromHub(hub).filter((t) => t.content_kind === contentKind)
}
