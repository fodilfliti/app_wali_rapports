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

function rowScopeKey(row: Record<string, unknown> | undefined): string {
  if (!row) return ''
  if (typeof row._entity_key === 'string' && row._entity_key) return row._entity_key
  return String(row.municipality_code || '')
}

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
    const fromKey = rowScopeKey(rows[fromIdx])
    const toKey = rowScopeKey(rows[toIdx])
    if (!fromKey || !toKey || fromKey !== toKey) return false
  }
  return true
}

/** Sequential line number in the current filtered view (1-based). */
export function visibleRowLineNumber(visibleIndex: number) {
  return visibleIndex + 1
}

/** In commune/entity bulk scope, # restarts at 1 within each entity block. */
export function visibleRowLineNumberForScope(
  rowEntries: { row: Record<string, unknown> }[],
  visibleIndex: number,
  scope: TableRowReorderScope = 'table',
) {
  if (scope !== 'commune') return visibleRowLineNumber(visibleIndex)
  const current = rowEntries[visibleIndex]?.row
  const key = rowScopeKey(current)
  if (!key) return visibleRowLineNumber(visibleIndex)
  let n = 0
  for (let i = 0; i <= visibleIndex; i++) {
    if (rowScopeKey(rowEntries[i]?.row) === key) n++
  }
  return n
}
