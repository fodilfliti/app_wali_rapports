export type TableRowEntry = { row: Record<string, unknown>; idx: number }

export type TableRowFilterMode = 'active' | 'finished' | 'all'

export function filterTableRowEntries(
  rows: Record<string, unknown>[],
  filterMode: TableRowFilterMode,
): TableRowEntry[] {
  return rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      if (filterMode === 'all') return true
      if (filterMode === 'finished') return row._row_finished === true
      return row._row_finished !== true
    })
}

export function countFinishedRows(rows: Record<string, unknown>[]) {
  return rows.filter((r) => r._row_finished === true).length
}

export function countActiveRows(rows: Record<string, unknown>[]) {
  return rows.filter((r) => r._row_finished !== true).length
}
