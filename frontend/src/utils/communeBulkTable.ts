import type { Column } from './tableLayout'

export const COMMUNE_NAME_COL_KEY = '__commune_name'

const communeNameColumn: Column = {
  key: COMMUNE_NAME_COL_KEY,
  type: 'text',
  label_ar: 'البلدية',
  label_fr: 'Commune',
}

/** Prepend read-only commune name column; drop duplicate commune_ref columns. */
export function withCommuneNameColumn(columns: Column[]): Column[] {
  const dataCols = columns.filter((c) => c.type !== 'commune_ref')
  return [communeNameColumn, ...dataCols]
}

export function communeDisplayName(
  row: Record<string, unknown>,
  locale: string,
): string {
  if (locale === 'fr') {
    return String(row._municipality_name_fr || row._municipality_name_ar || row.municipality_code || '')
  }
  return String(row._municipality_name_ar || row._municipality_name_fr || row.municipality_code || '')
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
  return [...rows].sort((a, b) =>
    String(a.municipality_code || '').localeCompare(String(b.municipality_code || '')),
  )
}

export function buildEmptyCommuneRow(
  municipality: { code: string; name_ar: string; name_fr: string },
  template?: Record<string, unknown>,
) {
  const row: Record<string, unknown> = template
    ? { ...template }
    : {
        _highlight: 'none',
        _row_finished: false,
        _wali_visible: true,
        _cell_colors: {},
      }
  row.municipality_code = municipality.code
  row._municipality_name_ar = municipality.name_ar
  row._municipality_name_fr = municipality.name_fr
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

export function lastRowIndexForCommune(rows: Record<string, unknown>[], code: string) {
  let idx = -1
  rows.forEach((r, i) => {
    if (r.municipality_code === code) idx = i
  })
  return idx
}
