import { getApiBase } from './apiBase'

const API_BASE = getApiBase()

export type MediaFile = {
  id: number
  storage_key: string
  original_name: string
  mime_type: string
  media_kind: 'image' | 'video' | 'file'
  url_path: string
}

export type MediaRow = { items: { file_id: number }[] }

export function fileUrl(token: string, file: MediaFile | undefined | null) {
  if (!file?.url_path) return ''
  const sep = file.url_path.includes('?') ? '&' : '?'
  return `${API_BASE}${file.url_path}${sep}access_token=${encodeURIComponent(token)}`
}

export function emptyMediaRow(): MediaRow {
  return { items: [] }
}

export function normalizeMediaRows(rows: MediaRow[] | undefined): MediaRow[] {
  return (rows || [])
    .map((row) => ({
      items: (row.items || []).slice(0, 2).filter((it) => it.file_id),
    }))
    .filter((row) => row.items.length)
}
