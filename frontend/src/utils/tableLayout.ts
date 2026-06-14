import { pickBilingualText } from './bilingual'

export type Column = {
  key: string
  type: string
  label_ar: string
  label_fr: string
  format?: string
  footer_aggregate?: string
  merge_vertical_suggested?: boolean
  choices?: { value: string; label_ar: string; label_fr: string }[]
}

export type HeaderGroup = {
  label_ar: string
  label_fr: string
  column_keys: string[]
}

export type LayoutJson = {
  header_groups?: HeaderGroup[]
  default_title_ar?: string
  default_title_fr?: string
  default_subtitle_ar?: string
  default_subtitle_fr?: string
}

export type TableMeta = {
  title_ar?: string
  title_fr?: string
  subtitle_ar?: string
  subtitle_fr?: string
  merge_column_keys?: string[]
}

function cellMergeKey(row: Record<string, unknown>, colKey: string) {
  if (colKey === 'municipality_code' || colKey.endsWith('_code')) {
    return row[colKey] ?? row._municipality_name_ar ?? row._municipality_name_fr ?? ''
  }
  return row[colKey]
}

export function buildHeaderModel(columns: Column[], layoutJson: LayoutJson | null | undefined, locale: string) {
  const cols = columns || []
  const groups = layoutJson?.header_groups || []
  const groupedKeys = new Set<string>()
  for (const g of groups) {
    for (const k of g.column_keys || []) groupedKeys.add(k)
  }

  const groupRow: { label: string; colSpan: number; placeholder?: boolean }[] = []
  const columnRow: { key: string; label: string }[] = []

  for (const g of groups) {
    const keys = (g.column_keys || []).filter((k) => cols.some((c) => c.key === k))
    if (!keys.length) continue
    groupRow.push({
      label: pickBilingualText(g.label_ar, g.label_fr, locale),
      colSpan: keys.length,
    })
    for (const key of keys) {
      const col = cols.find((c) => c.key === key)
      if (col) {
        columnRow.push({
          key: col.key,
          label: pickBilingualText(col.label_ar, col.label_fr, locale),
        })
      }
    }
  }

  for (const col of cols) {
    if (groupedKeys.has(col.key)) continue
    groupRow.push({ label: '', colSpan: 1, placeholder: true })
    columnRow.push({
      key: col.key,
      label: pickBilingualText(col.label_ar, col.label_fr, locale),
    })
  }

  const hasRealGroups = groupRow.some((g) => !g.placeholder && g.label)
  return {
    hasGroupRow: hasRealGroups,
    groupRow: hasRealGroups ? groupRow : [],
    columnRow,
  }
}

export function computeRowSpanMap(rows: Record<string, unknown>[], mergeColumnKeys: string[] = []) {
  const map: Record<string, number[]> = {}
  if (!mergeColumnKeys.length || !rows?.length) return map

  for (const colKey of mergeColumnKeys) {
    map[colKey] = new Array(rows.length).fill(1)
    let i = 0
    while (i < rows.length) {
      const val = cellMergeKey(rows[i], colKey)
      let j = i + 1
      while (j < rows.length && cellMergeKey(rows[j], colKey) === val && val !== '' && val != null) {
        j += 1
      }
      const span = j - i
      map[colKey][i] = span
      for (let k = i + 1; k < j; k += 1) map[colKey][k] = 0
      i = j
    }
  }
  return map
}

export function colLabel(col: Column, locale: string) {
  return pickBilingualText(col.label_ar, col.label_fr, locale)
}

export function choiceLabel(col: Column, value: unknown, locale: string) {
  if (value == null || value === '') return '—'
  const hit = (col.choices || []).find((ch) => ch.value === value)
  if (!hit) return String(value)
  return pickBilingualText(hit.label_ar, hit.label_fr, locale)
}

export function formatCell(value: unknown, col: Column, locale = 'ar') {
  if (value == null || value === '') return '—'
  if (col.type === 'choice') return choiceLabel(col, value, locale)
  if (col.type === 'text' || col.type === 'date') return String(value)
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  if (col.format === 'percent') return `${n.toFixed(1)} %`
  if (col.format === 'currency') return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
  if (col.format === 'integer') return String(Math.round(n))
  return String(n)
}

export function computeColumnFooter(rows: Record<string, unknown>[], col: Column): number | null {
  const agg = col.footer_aggregate
  if (!agg) return null
  const nums = (rows || [])
    .map((row) => row[col.key])
    .map((val) => (val === '' || val == null ? NaN : Number(val)))
    .filter((n) => Number.isFinite(n))
  if (!nums.length && agg !== 'count') return null
  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
    case 'count':
      return nums.length
    default:
      return null
  }
}

export function columnsHaveFooter(columns: Column[]): boolean {
  return (columns || []).some((c) => Boolean(c.footer_aggregate))
}
