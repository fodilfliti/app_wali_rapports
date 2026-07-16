import { choiceLabel, colLabel, formatCell, type Column } from './tableLayout'

/** Mobile-first shell budget: scroll when estimated mins exceed this. */
export const VIEW_SCROLL_BUDGET_PX = 380

/** @deprecated Prefer VIEW_SCROLL_BUDGET_PX; kept for callers that still key off column count. */
export const VIEW_WIDE_COL_THRESHOLD = 6

const MIN_COL_PX = 48
const PORTRAIT_INNER_PX = 515
const SAMPLE_ROW_LIMIT = 40
const CELL_PAD_PX = 24

const CHAR_PX_AR = 9
const CHAR_PX_LATIN = 7.5

const COL_FLOOR_PX = {
  text: 132,
  number: 88,
  formula: 88,
  choice: 96,
  date: 112,
  commune_ref: 108,
  meta: 44,
  default: 96,
} as const

const COL_CAP_PX = {
  text: 280,
  number: 160,
  formula: 160,
  choice: 220,
  date: 140,
  commune_ref: 180,
  default: 200,
} as const

/** Text: ~3–4 words/line (~14–18 AR / ~20–24 Latin chars). */
const TEXT_CHARS_AR = 16
const TEXT_CHARS_LATIN = 22

export type TableLayoutPolicy = {
  totalCols: number
  dataColCount: number
  metaColCount: number
  rowCount: number
  orientation: 'portrait' | 'landscape'
  viewNeedsHorizontalScroll: boolean
  estimatedMinWidthPx: number
  /** Per data-column min width (same order as `columns`). */
  columnMinWidthsPx: number[]
}

function charPx(locale: string) {
  return locale === 'fr' ? CHAR_PX_LATIN : CHAR_PX_AR
}

function textLenPx(text: string, locale: string) {
  const s = String(text || '').trim()
  if (!s) return 0
  return Math.ceil(s.length * charPx(locale))
}

function clampCol(px: number, type: string) {
  const floor =
    COL_FLOOR_PX[type as keyof typeof COL_FLOOR_PX] ?? COL_FLOOR_PX.default
  const cap = COL_CAP_PX[type as keyof typeof COL_CAP_PX] ?? COL_CAP_PX.default
  return Math.min(cap, Math.max(floor, px))
}

function sampleRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return rows
  if (rows.length <= SAMPLE_ROW_LIMIT) return rows
  return rows.slice(0, SAMPLE_ROW_LIMIT)
}

function maxSampleContentPx(
  _col: Column,
  rows: Record<string, unknown>[],
  locale: string,
  render: (row: Record<string, unknown>) => string,
) {
  let max = 0
  for (const row of sampleRows(rows)) {
    const raw = render(row)
    if (!raw || raw === '—') continue
    max = Math.max(max, textLenPx(raw, locale))
  }
  return max
}

/**
 * Content-aware min width for one data column (header + sampled values).
 */
export function estimateColumnMinWidthPx(
  col: Column,
  rows: Record<string, unknown>[] = [],
  locale = 'ar',
): number {
  const type = col?.type || 'text'
  const headerPx = textLenPx(colLabel(col, locale), locale) + CELL_PAD_PX
  const cp = charPx(locale)

  if (type === 'choice') {
    let maxChoice = 0
    for (const ch of col.choices || []) {
      const label = locale === 'fr' ? ch.label_fr || ch.label_ar : ch.label_ar || ch.label_fr
      maxChoice = Math.max(maxChoice, textLenPx(label || ch.value, locale))
    }
    const samplePx = maxSampleContentPx(col, rows, locale, (row) =>
      choiceLabel(col, row[col.key], locale),
    )
    return clampCol(Math.max(headerPx, maxChoice + CELL_PAD_PX, samplePx + CELL_PAD_PX), 'choice')
  }

  if (type === 'text') {
    const wordFloor =
      (locale === 'fr' ? TEXT_CHARS_LATIN : TEXT_CHARS_AR) * cp + CELL_PAD_PX
    const samplePx = maxSampleContentPx(col, rows, locale, (row) => {
      const v = row[col.key]
      if (v == null || v === '') return ''
      const s = String(v)
      // Cap sample influence so one huge cell does not force full width (wrap handles rest).
      return s.length > 48 ? s.slice(0, 48) : s
    })
    // Prefer word-floor over full sample; sample only nudges toward longer short phrases.
    const contentFloor = Math.min(
      COL_CAP_PX.text,
      Math.max(wordFloor, Math.min(samplePx + CELL_PAD_PX, wordFloor * 1.35)),
    )
    return clampCol(Math.max(headerPx, contentFloor), 'text')
  }

  if (type === 'number' || type === 'formula') {
    const samplePx = maxSampleContentPx(col, rows, locale, (row) =>
      formatCell(row[col.key], col, locale),
    )
    return clampCol(Math.max(headerPx, samplePx + CELL_PAD_PX), type === 'formula' ? 'formula' : 'number')
  }

  if (type === 'date') {
    return clampCol(Math.max(headerPx, COL_FLOOR_PX.date), 'date')
  }

  if (type === 'commune_ref') {
    const samplePx = maxSampleContentPx(col, rows, locale, (row) => {
      const name =
        (locale === 'fr' ? row._municipality_name_fr : row._municipality_name_ar) ||
        row[col.key]
      return name == null || name === '' ? '' : String(name)
    })
    return clampCol(Math.max(headerPx, samplePx + CELL_PAD_PX), 'commune_ref')
  }

  return clampCol(Math.max(headerPx, COL_FLOOR_PX.default), 'default')
}

export function countViewMetaColumns(opts: {
  showRowMeta: boolean
  showAdminMeta?: boolean
  showDragCol?: boolean
  showDeleteCol?: boolean
}) {
  const { showRowMeta, showAdminMeta = false, showDragCol = false, showDeleteCol = false } = opts
  if (!showRowMeta && !showAdminMeta && !showDragCol && !showDeleteCol) return 0
  let n = 0
  if (showDragCol) n += 1
  if (showAdminMeta) n += 1 // wali-visible
  if (showRowMeta) n += 1 // line #
  if (showAdminMeta) n += 1 // finished
  if (showDeleteCol) n += 1
  return n
}

export function computeTableLayoutPolicy(input: {
  columns?: Column[]
  rows?: Record<string, unknown>[]
  dataColCount?: number
  metaColCount?: number
  embedded?: boolean
  locale?: string
}): TableLayoutPolicy {
  const rows = input.rows || []
  const rowCount = rows.length
  const dataCols = input.columns || []
  const dataColCount = input.dataColCount ?? dataCols.length
  const metaColCount = input.metaColCount ?? 0
  const totalCols = Math.max(1, metaColCount + dataColCount)
  const locale = input.locale === 'fr' ? 'fr' : 'ar'

  const columnMinWidthsPx = dataCols.map((col) => estimateColumnMinWidthPx(col, rows, locale))

  let estimatedMinWidthPx = metaColCount * COL_FLOOR_PX.meta
  if (columnMinWidthsPx.length) {
    estimatedMinWidthPx += columnMinWidthsPx.reduce((a, b) => a + b, 0)
  } else if (dataColCount > 0) {
    estimatedMinWidthPx += dataColCount * COL_FLOOR_PX.default
  }

  const useLandscape = totalCols * MIN_COL_PX > PORTRAIT_INNER_PX

  return {
    totalCols,
    dataColCount,
    metaColCount,
    rowCount,
    orientation: useLandscape ? 'landscape' : 'portrait',
    viewNeedsHorizontalScroll: estimatedMinWidthPx > VIEW_SCROLL_BUDGET_PX,
    estimatedMinWidthPx,
    columnMinWidthsPx,
  }
}

export function tableScrollShellClass(policy: TableLayoutPolicy, wide = policy.viewNeedsHorizontalScroll) {
  return wide ? 'tableScrollShell tableScrollShell--wide' : 'tableScrollShell'
}

/** Lookup min width for a column key from policy + columns list. */
export function columnMinWidthForKey(
  policy: TableLayoutPolicy,
  columns: Column[],
  key: string,
): number | undefined {
  const idx = columns.findIndex((c) => c.key === key)
  if (idx < 0) return undefined
  return policy.columnMinWidthsPx[idx]
}
