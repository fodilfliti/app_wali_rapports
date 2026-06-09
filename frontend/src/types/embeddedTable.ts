import type { Column, LayoutJson, TableMeta } from '../utils/tableLayout'

export type EmbeddedTable = {
  id: string
  schema_id?: number
  schema_slug: string
  schema_name_ar?: string
  schema_name_fr?: string
  columns: Column[]
  layout_json?: LayoutJson | null
  table_meta?: TableMeta
  rows: Record<string, unknown>[]
  /** True when columns are stored only inside this document, not as a service schema */
  rapport_only?: boolean
}

export type TableImportSnapshot = {
  rapport_id: number
  rapport_title: string
  schema_slug: string
  schema_name_ar?: string
  schema_name_fr?: string
  columns: Column[]
  layout_json?: LayoutJson | null
  table_meta?: TableMeta
  rows: Record<string, unknown>[]
}

export function cloneImportedTableSnapshot(snapshot: TableImportSnapshot): EmbeddedTable {
  return {
    id: crypto.randomUUID(),
    schema_slug: snapshot.schema_slug,
    schema_name_ar: snapshot.schema_name_ar,
    schema_name_fr: snapshot.schema_name_fr,
    columns: structuredClone(snapshot.columns),
    layout_json: snapshot.layout_json ? structuredClone(snapshot.layout_json) : null,
    table_meta: structuredClone(snapshot.table_meta || {}),
    rows: (snapshot.rows || []).map((row) => ({ ...row })),
    rapport_only: true,
  }
}

export function emptyRowsForColumns(columns: Column[], count = 1): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    const row: Record<string, unknown> = { _row_finished: false, _wali_visible: true, _cell_colors: {} }
    for (const col of columns) {
      if (col.type === 'number' || col.type === 'formula') row[col.key] = null
      else row[col.key] = ''
    }
    rows.push(row)
  }
  return rows
}

export function extractSchemaTableIds(html: string): string[] {
  const ids: string[] = []
  const re = /data-schema-table-id="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) ids.push(m[1])
  return ids
}

export function pruneEmbeddedTables(html: string, tables: EmbeddedTable[]): EmbeddedTable[] {
  const used = new Set(extractSchemaTableIds(html))
  return tables.filter((t) => used.has(t.id))
}
