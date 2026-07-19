import type { Column } from './tableLayout'

export const COMMUNE_NAME_COL_KEY = '__commune_name'

const KIND_ORDER: Record<string, number> = {
  commune: 0,
  daira: 1,
  direction: 2,
}

const entityNameColumn: Column = {
  key: COMMUNE_NAME_COL_KEY,
  type: 'text',
  label_ar: 'العنصر',
  label_fr: 'Élément',
}

export type BulkEntityRef = {
  code: string
  name_ar?: string
  name_fr?: string
  kind?: string
  entity_key?: string
}

/** Prepend read-only entity name column; drop duplicate commune_ref columns. */
export function withCommuneNameColumn(columns: Column[]): Column[] {
  const dataCols = columns.filter((c) => c.type !== 'commune_ref')
  return [entityNameColumn, ...dataCols]
}

export function rowEntityKey(row: Record<string, unknown>): string {
  if (typeof row._entity_key === 'string' && row._entity_key) return row._entity_key
  const code = String(row.municipality_code || '')
  const kind = typeof row._entity_kind === 'string' && row._entity_kind ? row._entity_kind : 'commune'
  return code ? `${kind}:${code}` : ''
}

export function communeDisplayName(
  row: Record<string, unknown>,
  locale: string,
): string {
  const name =
    locale === 'fr'
      ? String(row._municipality_name_fr || row._municipality_name_ar || row.municipality_code || '')
      : String(row._municipality_name_ar || row._municipality_name_fr || row.municipality_code || '')
  return name
}

export function rowsWithCommuneNames(rows: Record<string, unknown>[], locale: string) {
  return rows.map((row) => ({
    ...row,
    [COMMUNE_NAME_COL_KEY]: communeDisplayName(row, locale),
  }))
}

export function stripCommuneDisplayFields(row: Record<string, unknown>) {
  const next = { ...row }
  delete next[COMMUNE_NAME_COL_KEY]
  return next
}

export function sortRowsByCommune(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => {
    const kindA = String(a._entity_kind || 'commune')
    const kindB = String(b._entity_kind || 'commune')
    const kindCmp = (KIND_ORDER[kindA] ?? 9) - (KIND_ORDER[kindB] ?? 9)
    if (kindCmp !== 0) return kindCmp
    const keyCmp = rowEntityKey(a).localeCompare(rowEntityKey(b))
    if (keyCmp !== 0) return keyCmp
    return String(a.municipality_code || '').localeCompare(String(b.municipality_code || ''))
  })
}

export function buildEmptyCommuneRow(
  entity: BulkEntityRef,
  template?: Record<string, unknown>,
) {
  const kind = entity.kind || 'commune'
  const key = entity.entity_key || `${kind}:${entity.code}`
  const row: Record<string, unknown> = template
    ? { ...template }
    : {
        _highlight: 'none',
        _row_finished: false,
        _wali_visible: true,
        _cell_colors: {},
      }
  row.municipality_code = entity.code
  row._entity_key = key
  row._entity_kind = kind
  row._municipality_name_ar = entity.name_ar
  row._municipality_name_fr = entity.name_fr
  Object.keys(row).forEach((k) => {
    if (
      !k.startsWith('_') &&
      k !== 'municipality_code' &&
      k !== COMMUNE_NAME_COL_KEY
    ) {
      row[k] = null
    }
  })
  return row
}

export function lastRowIndexForCommune(rows: Record<string, unknown>[], entityKeyOrCode: string) {
  let idx = -1
  rows.forEach((r, i) => {
    if (rowEntityKey(r) === entityKeyOrCode || r.municipality_code === entityKeyOrCode) idx = i
  })
  return idx
}
