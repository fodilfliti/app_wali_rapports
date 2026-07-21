export type RapportStatusGroup =
  | 'all'
  | 'in_progress'
  | 'needs_edit'
  | 'done'
  | 'new'
  | 'delete_requested'

export type RapportStatusGroupRole = 'office' | 'admin' | 'wali' | 'chef'

const VALID: RapportStatusGroup[] = [
  'all',
  'in_progress',
  'needs_edit',
  'done',
  'new',
  'delete_requested',
]

export function parseStatusGroupParam(raw: string | null): RapportStatusGroup {
  const g = String(raw || '')
    .trim()
    .toLowerCase()
  if ((VALID as string[]).includes(g)) return g as RapportStatusGroup
  return 'all'
}

export function statusGroupChips(
  role: RapportStatusGroupRole,
): { id: RapportStatusGroup; labelKey: string }[] {
  const base: { id: RapportStatusGroup; labelKey: string }[] = [
    { id: 'all', labelKey: 'statusGroupAll' },
    { id: 'in_progress', labelKey: 'statusGroupInProgress' },
    { id: 'needs_edit', labelKey: 'statusGroupNeedsEdit' },
    { id: 'done', labelKey: 'statusGroupDone' },
  ]
  if (role === 'wali') {
    return [
      { id: 'all', labelKey: 'statusGroupAll' },
      { id: 'new', labelKey: 'statusGroupNew' },
      { id: 'in_progress', labelKey: 'statusGroupInProgress' },
      { id: 'needs_edit', labelKey: 'statusGroupNeedsEdit' },
      { id: 'done', labelKey: 'statusGroupDone' },
    ]
  }
  if (role === 'chef') {
    return [
      { id: 'all', labelKey: 'statusGroupAll' },
      { id: 'new', labelKey: 'statusGroupNew' },
      { id: 'delete_requested', labelKey: 'statusGroupDeleteRequested' },
      { id: 'in_progress', labelKey: 'statusGroupInProgress' },
      { id: 'needs_edit', labelKey: 'statusGroupNeedsEdit' },
      { id: 'done', labelKey: 'statusGroupDone' },
    ]
  }
  return base
}
