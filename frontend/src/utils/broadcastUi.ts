export function formatBroadcastFileSize(bytes?: number | null): string {
  const n = Number(bytes)
  if (!n || n < 1) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function broadcastFileExtension(name?: string | null): string {
  if (!name) return 'FILE'
  const m = String(name).match(/\.([^.]+)$/)
  return m ? m[1].toUpperCase() : 'FILE'
}

export function userInitials(name?: string | null, username?: string | null): string {
  const s = String(name || username || '?').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

export function broadcastFileKindClass(ext: string): string {
  const e = ext.toLowerCase()
  if (['xlsx', 'xls', 'csv'].includes(e)) return 'broadcastFileKind--sheet'
  if (['doc', 'docx', 'odt'].includes(e)) return 'broadcastFileKind--doc'
  if (['pdf'].includes(e)) return 'broadcastFileKind--pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e)) return 'broadcastFileKind--image'
  return 'broadcastFileKind--file'
}
