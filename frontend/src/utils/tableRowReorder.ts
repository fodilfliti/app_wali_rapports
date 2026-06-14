/** Reorder rows in array (indices refer to positions before the move). */
export function reorderRowsArray<T>(
  rows: T[],
  fromIdx: number,
  toIdx: number,
): T[] {
  if (fromIdx === toIdx) return rows
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= rows.length || toIdx >= rows.length) {
    return rows
  }
  const next = [...rows]
  const [item] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, item)
  return next
}

export type TableRowReorderScope = 'table' | 'commune'

export function canReorderRowTo(
  rows: Record<string, unknown>[],
  fromIdx: number,
  toIdx: number,
  scope: TableRowReorderScope = 'table',
): boolean {
  if (fromIdx === toIdx) return false
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= rows.length || toIdx >= rows.length) {
    return false
  }
  if (scope === 'commune') {
    const fromCode = rows[fromIdx]?.municipality_code
    const toCode = rows[toIdx]?.municipality_code
    if (!fromCode || !toCode || fromCode !== toCode) return false
  }
  return true
}

/** Sequential line number in the current filtered view (1-based). */
export function visibleRowLineNumber(visibleIndex: number) {
  return visibleIndex + 1
}

/** In commune bulk scope, # restarts at 1 within each municipality block. */
export function visibleRowLineNumberForScope(
  rowEntries: { row: Record<string, unknown> }[],
  visibleIndex: number,
  scope: TableRowReorderScope = 'table',
) {
  if (scope !== 'commune') return visibleRowLineNumber(visibleIndex)
  const current = rowEntries[visibleIndex]?.row
  const code = current?.municipality_code
  if (!code) return visibleRowLineNumber(visibleIndex)
  let n = 0
  for (let i = 0; i <= visibleIndex; i++) {
    if (rowEntries[i]?.row?.municipality_code === code) n++
  }
  return n
}
