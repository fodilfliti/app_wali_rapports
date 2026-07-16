import type { HubIconName } from '../components/HubIcons'

export type RapportTypeNav = {
  id: number
  name_ar?: string
  name_fr?: string
  content_kind: string
  /** For `commune_list`: `table` (bulk grid) or `complex` (per-entity document). */
  commune_content_kind?: string | null
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
  // Section-level: قائمة keeps the map pin; per-type tiles use table/document via commune_content_kind.
  if (contentKind === 'commune_list') return 'communes'
  return rapportTypeHubIcon({ content_kind: contentKind })
}

export function officeContentKindPath(serviceId: number, contentKind: string) {
  return `/office/services/${serviceId}/kinds/${contentKind}`
}

export function waliContentKindPath(userId: number, serviceId: number, contentKind: string) {
  return `/wali/office-users/${userId}/services/${serviceId}/kinds/${contentKind}`
}

export function reviewerContentKindPath(
  mode: import('./reviewerMode').ReviewerMode,
  userId: number,
  serviceId: number,
  contentKind: string,
) {
  const base = mode === 'chef' ? '/chef' : '/wali'
  return `${base}/office-users/${userId}/services/${serviceId}/kinds/${contentKind}`
}

export function waliRapportTypeListPath(userId: number, serviceId: number, rt: RapportTypeNav) {
  return `/wali/office-users/${userId}/services/${serviceId}/rapports/${rt.id}`
}

export function reviewerRapportTypeListPath(
  mode: import('./reviewerMode').ReviewerMode,
  userId: number,
  serviceId: number,
  rapportTypeId: number,
) {
  const base = mode === 'chef' ? '/chef' : '/wali'
  return `${base}/office-users/${userId}/services/${serviceId}/rapports/${rapportTypeId}`
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

/** Icon for a rapport type tile — table vs complex file (and commune list subtypes). */
export function rapportTypeHubIcon(
  rt: string | Pick<RapportTypeNav, 'content_kind' | 'commune_content_kind'>,
): HubIconName {
  const contentKind = typeof rt === 'string' ? rt : rt.content_kind
  const communeKind = typeof rt === 'string' ? undefined : rt.commune_content_kind

  if (contentKind === 'table_grid') return 'table'
  if (contentKind === 'document_compose') return 'document'
  if (contentKind === 'fiche_lecture') return 'fiche'
  if (contentKind === 'commune_list') {
    // قائمة: وضع جدول vs ملف مركّب لكل جهة
    if (communeKind === 'table') return 'table'
    return 'document'
  }
  return 'rapports'
}

/** CSS modifier for hub tile icon color (table vs complex). */
export function rapportTypeHubKindClass(
  rt: Pick<RapportTypeNav, 'content_kind' | 'commune_content_kind'>,
): string {
  if (rt.content_kind === 'commune_list') {
    return rt.commune_content_kind === 'table'
      ? 'hubTile--kind-table_grid'
      : 'hubTile--kind-document_compose'
  }
  return `hubTile--kind-${rt.content_kind}`
}

export function officeServiceHubPath(serviceId: number) {
  return `/office/services/${serviceId}`
}

export function officeRapportTypeListPath(serviceId: number, rapportTypeId: number) {
  return `/office/services/${serviceId}/rapports/${rapportTypeId}`
}

export function officeNewDocumentPath(
  serviceId: number,
  opts: {
    rapportTypeId: number
    templateId?: number | null
    skipDefault?: boolean
  },
) {
  const q = new URLSearchParams({
    rapport_type_id: String(opts.rapportTypeId),
  })
  if (opts.templateId != null) q.set('template_id', String(opts.templateId))
  if (opts.skipDefault) q.set('skip_default', '1')
  return `/office/services/${serviceId}/documents/new?${q.toString()}`
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

export function canOfficeEditRapport(status: string) {
  return status === 'draft' || status === 'changes_requested'
}

/** Office may recall a sent rapport to draft before Wali accept/view. */
export function canOfficeReturnToDraft(status: string) {
  return (
    status === 'pending_chef' ||
    status === 'submitted' ||
    status === 'under_review'
  )
}

export function isAwaitingWaliResponse(status: string) {
  return status === 'submitted' || status === 'under_review'
}

export function isAwaitingChefResponse(status: string) {
  return status === 'pending_chef'
}

export function isAwaitingReviewerResponse(status: string) {
  return isAwaitingChefResponse(status) || isAwaitingWaliResponse(status)
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

export function officeEntityEditorPath(
  serviceId: number,
  entityKeyOrCode: string,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams()
  if (opts?.rapportTypeId) q.set('rapport_type_id', String(opts.rapportTypeId))
  if (opts?.rapportId) q.set('rapport_id', String(opts.rapportId))
  const qs = q.toString()
  return `/office/services/${serviceId}/communes/${encodeURIComponent(entityKeyOrCode)}${qs ? `?${qs}` : ''}`
}

export const officeCommuneEditorPath = officeEntityEditorPath

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
