import { buildColumnsPayload, type DraftSchemaColumn } from './schemaColumns'
import { bilingualPairForSave, hasBilingualText } from './bilingual'
import type { LayoutJson } from './tableLayout'

export type DraftHeaderGroup = {
  uid: string
  label_ar: string
  label_fr: string
  column_uids: string[]
}

export function newDraftHeaderGroup(): DraftHeaderGroup {
  return {
    uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label_ar: '',
    label_fr: '',
    column_uids: [],
  }
}

export function defaultDraftHeaderGroups(): DraftHeaderGroup[] {
  return []
}

export function buildLayoutJsonFromDraft(
  columns: DraftSchemaColumn[],
  groups: DraftHeaderGroup[],
): LayoutJson | null {
  const payload = buildColumnsPayload(columns)
  const uidToKey = new Map<string, string>()
  columns.forEach((c, i) => {
    const key = payload[i]?.key
    if (key) uidToKey.set(c.uid, key)
  })

  const header_groups = (groups || [])
    .filter((g) => hasBilingualText(g.label_ar, g.label_fr) && g.column_uids.length >= 1)
    .map((g) => {
      const labels = bilingualPairForSave(g.label_ar, g.label_fr)
      return {
        label_ar: labels.ar,
        label_fr: labels.fr,
        column_keys: g.column_uids.map((uid) => uidToKey.get(uid)).filter((k): k is string => Boolean(k)),
      }
    })
    .filter((g) => g.column_keys.length >= 1)

  return header_groups.length ? { header_groups } : null
}

export function validateDraftHeaderGroups(
  groups: DraftHeaderGroup[],
  columns: DraftSchemaColumn[],
): string | null {
  const columnUids = new Set(columns.map((c) => c.uid))
  const assigned = new Set<string>()

  for (const g of groups || []) {
    const activeUids = g.column_uids.filter((uid) => columnUids.has(uid))
    if (!activeUids.length && !hasBilingualText(g.label_ar, g.label_fr)) continue
    if (!hasBilingualText(g.label_ar, g.label_fr)) return 'bilingualLabelRequired'
    if (activeUids.length < 1) return 'schemaHeaderGroupMinColumns'
    for (const uid of activeUids) {
      if (assigned.has(uid)) return 'schemaHeaderGroupDuplicateColumn'
      assigned.add(uid)
    }
  }
  return null
}

export function pruneHeaderGroupsForColumns(
  groups: DraftHeaderGroup[],
  columns: DraftSchemaColumn[],
): DraftHeaderGroup[] {
  const columnUids = new Set(columns.map((c) => c.uid))
  return groups.map((g) => ({
    ...g,
    column_uids: g.column_uids.filter((uid) => columnUids.has(uid)),
  }))
}

export function buildPreviewLayoutFromDraft(
  columns: DraftSchemaColumn[],
  groups: DraftHeaderGroup[],
  previewPayload: { key: string }[],
): LayoutJson | null {
  const header_groups = (groups || [])
    .map((g) => {
      const column_keys = g.column_uids
        .map((uid) => {
          const idx = columns.findIndex((c) => c.uid === uid)
          return idx >= 0 ? previewPayload[idx]?.key : undefined
        })
        .filter((k): k is string => Boolean(k))
      if (column_keys.length < 1) return null
      return {
        label_ar: g.label_ar.trim() || g.label_fr.trim() || '…',
        label_fr: g.label_fr.trim() || g.label_ar.trim() || '…',
        column_keys,
      }
    })
    .filter((g): g is NonNullable<typeof g> => g != null)

  return header_groups.length ? { header_groups } : null
}

export function columnLabelForDraft(col: DraftSchemaColumn, lang: string, index: number, t: (k: string) => string) {
  const label =
    lang === 'fr'
      ? col.label_fr.trim() || col.label_ar.trim()
      : col.label_ar.trim() || col.label_fr.trim()
  return label || `${t('schemaColumn')} ${index + 1}`
}

export type ColumnGroupBoundary = {
  grouped: boolean
  groupStart: boolean
  groupEnd: boolean
}

/** Which vertical borders to draw in preview for a column under header groups. */
export function columnGroupBoundary(
  colKey: string,
  columns: DraftSchemaColumn[],
  groups: DraftHeaderGroup[],
  previewPayload: { key: string }[],
): ColumnGroupBoundary {
  for (const g of groups || []) {
    const keys = g.column_uids
      .map((uid) => {
        const idx = columns.findIndex((c) => c.uid === uid)
        return idx >= 0 ? previewPayload[idx]?.key : undefined
      })
      .filter((k): k is string => Boolean(k))
    const pos = keys.indexOf(colKey)
    if (pos >= 0) {
      return { grouped: true, groupStart: pos === 0, groupEnd: pos === keys.length - 1 }
    }
  }
  return { grouped: false, groupStart: false, groupEnd: false }
}

export function previewColumnCellClass(boundary: ColumnGroupBoundary) {
  const parts: string[] = []
  if (boundary.grouped) parts.push('schemaPreviewColGrouped')
  if (boundary.groupStart) parts.push('schemaPreviewGroupBoundaryStart')
  if (boundary.groupEnd) parts.push('schemaPreviewGroupBoundaryEnd')
  return parts.join(' ')
}

export function headerGroupsFromLayout(
  draftColumns: DraftSchemaColumn[],
  layoutJson: LayoutJson | null | undefined,
): DraftHeaderGroup[] {
  const payload = buildColumnsPayload(draftColumns)
  const keyToUid = new Map<string, string>()
  draftColumns.forEach((c, i) => {
    const k = c.key?.trim() || payload[i]?.key
    if (k) keyToUid.set(k, c.uid)
  })
  return (layoutJson?.header_groups || []).map((g) => ({
    uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label_ar: g.label_ar,
    label_fr: g.label_fr,
    column_uids: (g.column_keys || [])
      .map((k) => keyToUid.get(k))
      .filter((uid): uid is string => Boolean(uid)),
  }))
}
