export type TableColorKey = 'none' | 'important' | 'warning' | 'info' | 'success' | string

export const TABLE_COLOR_PRESETS: { key: TableColorKey; bg: string; border: string }[] = [
  { key: 'none', bg: 'transparent', border: '#d1d5db' },
  { key: 'important', bg: '#fde8e8', border: '#991b1b' },
  { key: 'warning', bg: '#fef3c7', border: '#b45309' },
  { key: 'info', bg: '#dbeafe', border: '#1d4ed8' },
  { key: 'success', bg: '#dcfce7', border: '#166534' },
]

export function tableColorBackground(color: string | null | undefined): string | undefined {
  if (!color || color === 'none') return undefined
  const preset = TABLE_COLOR_PRESETS.find((p) => p.key === color)
  if (preset) return preset.bg === 'transparent' ? undefined : preset.bg
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  return undefined
}

export function tableColorBorder(color: string | null | undefined): string | undefined {
  if (!color || color === 'none') return undefined
  const preset = TABLE_COLOR_PRESETS.find((p) => p.key === color)
  if (preset) return preset.border
  return '#6b7280'
}

export function readRowCellColors(row: Record<string, unknown>): Record<string, string> {
  const raw = row._cell_colors
  if (!raw || typeof raw !== 'object') return {}
  return { ...(raw as Record<string, string>) }
}

export function cellColorFor(row: Record<string, unknown>, colKey: string): string | undefined {
  return readRowCellColors(row)[colKey]
}
