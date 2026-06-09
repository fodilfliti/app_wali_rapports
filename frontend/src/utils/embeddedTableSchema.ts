import type { EmbeddedTable } from '../types/embeddedTable'
import type { Column } from './tableLayout'

export type ServiceSchemaRecord = {
  id?: number
  slug: string
  name_ar?: string
  name_fr?: string
  columns_json?: Column[]
  layout_json?: EmbeddedTable['layout_json']
}

export function isLinkedToServiceSchema(table: EmbeddedTable): boolean {
  if (table.rapport_only === true) return false
  if (table.schema_slug.startsWith('local-')) return false
  return true
}

export function buildSchemaLookup(schemas: ServiceSchemaRecord[]): Map<string, ServiceSchemaRecord> {
  return new Map(schemas.map((s) => [s.slug, s]))
}

function defaultCellForColumn(col: Column): unknown {
  if (col.type === 'number' || col.type === 'formula') return null
  if (col.type === 'choice') return col.choices?.[0]?.value ?? ''
  return ''
}

export function mergeRowsWithColumns(rows: Record<string, unknown>[], columns: Column[]) {
  return (rows || []).map((row) => {
    const next = { ...row }
    for (const col of columns) {
      if (!(col.key in next)) next[col.key] = defaultCellForColumn(col)
    }
    return next
  })
}

export function resolveEmbeddedTable(table: EmbeddedTable, lookup: Map<string, ServiceSchemaRecord>): EmbeddedTable {
  if (!isLinkedToServiceSchema(table)) return table
  const schema = lookup.get(table.schema_slug)
  if (!schema) return table
  const columns = (schema.columns_json || []) as Column[]
  return {
    ...table,
    schema_id: schema.id ?? table.schema_id,
    schema_name_ar: schema.name_ar ?? table.schema_name_ar,
    schema_name_fr: schema.name_fr ?? table.schema_name_fr,
    columns,
    layout_json: schema.layout_json ?? null,
    rows: mergeRowsWithColumns(table.rows, columns),
    rapport_only: false,
  }
}

export function resolveEmbeddedTables(
  tables: EmbeddedTable[],
  schemas: ServiceSchemaRecord[],
): EmbeddedTable[] {
  const lookup = buildSchemaLookup(schemas)
  return tables.map((t) => resolveEmbeddedTable(t, lookup))
}

export function embeddedTablesEqual(a: EmbeddedTable[], b: EmbeddedTable[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
