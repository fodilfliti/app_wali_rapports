import type { Column } from './tableLayout'

export const VIEW_WIDE_COL_THRESHOLD = 6

const MIN_COL_PX = 48
const PORTRAIT_INNER_PX = 515

const COL_MIN_PX = {
  text: 132,
  number: 76,
  commune_ref: 108,
  meta: 44,
  default: 96,
} as const

export type TableLayoutPolicy = {
  totalCols: number
  dataColCount: number
  metaColCount: number
  rowCount: number
  orientation: 'portrait' | 'landscape'
  viewNeedsHorizontalScroll: boolean
  estimatedMinWidthPx: number
}

function columnMinPx(col?: Column) {
  const t = col?.type || 'text'
  return COL_MIN_PX[t as keyof typeof COL_MIN_PX] || COL_MIN_PX.default
}

export function countViewMetaColumns(showRowMeta: boolean, editable: boolean) {
  if (!showRowMeta) return 0
  let n = 1
  if (editable) n += 2
  return n
}

export function computeTableLayoutPolicy(input: {
  columns?: Column[]
  rows?: Record<string, unknown>[]
  dataColCount?: number
  metaColCount?: number
  embedded?: boolean
}): TableLayoutPolicy {
  const rows = input.rows || []
  const rowCount = rows.length
  const dataCols = input.columns || []
  const dataColCount = input.dataColCount ?? dataCols.length
  const metaColCount = input.metaColCount ?? 0
  const totalCols = Math.max(1, metaColCount + dataColCount)

  let estimatedMinWidthPx = metaColCount * COL_MIN_PX.meta
  for (const col of dataCols) {
    estimatedMinWidthPx += columnMinPx(col)
  }
  if (!dataCols.length && dataColCount > 0) {
    estimatedMinWidthPx += dataColCount * COL_MIN_PX.default
  }

  const useLandscape = totalCols * MIN_COL_PX > PORTRAIT_INNER_PX

  return {
    totalCols,
    dataColCount,
    metaColCount,
    rowCount,
    orientation: useLandscape ? 'landscape' : 'portrait',
    viewNeedsHorizontalScroll: totalCols > VIEW_WIDE_COL_THRESHOLD,
    estimatedMinWidthPx,
  }
}

export function tableScrollShellClass(policy: TableLayoutPolicy, wide = policy.viewNeedsHorizontalScroll) {
  return wide ? 'tableScrollShell tableScrollShell--wide' : 'tableScrollShell'
}
