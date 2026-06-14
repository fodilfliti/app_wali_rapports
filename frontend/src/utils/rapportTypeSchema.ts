/** Whether creating/editing a rapport type requires linking a table schema. */
export function needsLinkedTableSchema(
  contentKind: string,
  communeContentKind?: string | null,
): boolean {
  if (contentKind === 'table_grid') return true
  if (contentKind === 'commune_list') return communeContentKind === 'table'
  return false
}
