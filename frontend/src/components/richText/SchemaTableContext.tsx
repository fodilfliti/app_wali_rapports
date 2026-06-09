import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { EmbeddedTable } from '../../types/embeddedTable'

type Ctx = {
  tables: Record<string, EmbeddedTable>
  upsertTable: (table: EmbeddedTable) => void
  updateTable: (id: string, patch: Partial<EmbeddedTable>) => void
  removeTable: (id: string) => void
  setTablesFromList: (list: EmbeddedTable[]) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  readOnly: boolean
}

const SchemaTableContext = createContext<Ctx | null>(null)

export function SchemaTableProvider({
  initialTables,
  readOnly = false,
  children,
}: {
  initialTables: EmbeddedTable[]
  readOnly?: boolean
  children: ReactNode
}) {
  const [tables, setTables] = useState<Record<string, EmbeddedTable>>(() =>
    Object.fromEntries(initialTables.map((t) => [t.id, t])),
  )
  const [editingId, setEditingId] = useState<string | null>(null)

  const upsertTable = useCallback((table: EmbeddedTable) => {
    setTables((prev) => ({ ...prev, [table.id]: table }))
  }, [])

  const updateTable = useCallback((id: string, patch: Partial<EmbeddedTable>) => {
    setTables((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev))
  }, [])

  const removeTable = useCallback((id: string) => {
    setTables((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const setTablesFromList = useCallback((list: EmbeddedTable[]) => {
    setTables(Object.fromEntries(list.map((t) => [t.id, t])))
  }, [])

  const value = useMemo(
    () => ({
      tables,
      upsertTable,
      updateTable,
      removeTable,
      setTablesFromList,
      editingId,
      setEditingId,
      readOnly,
    }),
    [tables, upsertTable, updateTable, removeTable, setTablesFromList, editingId, readOnly],
  )

  return <SchemaTableContext.Provider value={value}>{children}</SchemaTableContext.Provider>
}

export function useSchemaTables() {
  const ctx = useContext(SchemaTableContext)
  if (!ctx) throw new Error('useSchemaTables outside provider')
  return ctx
}

export function useSchemaTablesOptional() {
  return useContext(SchemaTableContext)
}
