export type RapportListSort = 'created_at' | 'updated_at'

export function parseListSortParam(raw: string | null): RapportListSort {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'updated_at') return 'updated_at'
  return 'created_at'
}

export const LIST_SORT_CHIPS: { id: RapportListSort; labelKey: string }[] = [
  { id: 'created_at', labelKey: 'sortByCreatedAt' },
  { id: 'updated_at', labelKey: 'sortByUpdatedAt' },
]
