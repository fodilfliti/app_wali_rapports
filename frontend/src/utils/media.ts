import { getApiBase } from './apiBase'

const API_BASE = getApiBase()

export type MediaFile = {
  id: number
  storage_key: string
  original_name: string
  mime_type: string
  size_bytes?: number
  media_kind: 'image' | 'video' | 'file'
  url_path: string
}

export type MediaRow = { items: { file_id: number }[] }

export const MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MEDIA_MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const MEDIA_MAX_FILE_BYTES = 25 * 1024 * 1024
export const MEDIA_MAX_ATTACHMENTS = 30

export class MediaUploadError extends Error {
  key: string
  params?: Record<string, string>

  constructor(key: string, params?: Record<string, string>) {
    super(key)
    this.key = key
    this.params = params
  }
}

export function fileUrl(token: string, file: MediaFile | undefined | null) {
  if (!file?.url_path) return ''
  const sep = file.url_path.includes('?') ? '&' : '?'
  return `${API_BASE}${file.url_path}${sep}access_token=${encodeURIComponent(token)}`
}

export function emptyMediaRow(): MediaRow {
  return { items: [] }
}

export function maxBytesForMime(mime: string) {
  if (mime.startsWith('image/')) return MEDIA_MAX_IMAGE_BYTES
  if (mime.startsWith('video/')) return MEDIA_MAX_VIDEO_BYTES
  return MEDIA_MAX_FILE_BYTES
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function flattenMediaRows(rows: MediaRow[] | undefined): number[] {
  const ids: number[] = []
  for (const row of rows || []) {
    for (const it of row.items || []) {
      if (it.file_id) ids.push(Number(it.file_id))
    }
  }
  return ids
}

export function mediaRowsFromFileIds(ids: number[]): MediaRow[] {
  const items = ids.filter(Boolean).map((file_id) => ({ file_id }))
  return items.length ? [{ items }] : []
}

export function normalizeMediaRows(rows: MediaRow[] | undefined): MediaRow[] {
  return mediaRowsFromFileIds(flattenMediaRows(rows))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function compressImage(file: File, maxBytes: number): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new MediaUploadError('mediaImageReadFailed'))
      el.src = url
    })

    let width = img.naturalWidth
    let height = img.naturalHeight
    const maxDim = 1920
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new MediaUploadError('mediaImageReadFailed')
    ctx.drawImage(img, 0, 0, width, height)

    const attempts: { type: string; ext: string; qualities: (number | undefined)[] }[] =
      file.type === 'image/png'
        ? [
            { type: 'image/png', ext: '.png', qualities: [undefined] },
            { type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
          ]
        : [{ type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] }]

    for (const attempt of attempts) {
      for (const quality of attempt.qualities) {
        const blob = await canvasToBlob(canvas, attempt.type, quality as number)
        if (!blob) continue
        if (blob.size <= maxBytes) {
          const base = file.name.replace(/\.[^.]+$/, '') || 'image'
          return new File([blob], `${base}${attempt.ext}`, { type: attempt.type })
        }
      }
    }

    throw new MediaUploadError('mediaFileTooLarge', { max: formatBytes(maxBytes) })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function prepareFileForUpload(file: File): Promise<File> {
  const mime = file.type || 'application/octet-stream'
  const max = maxBytesForMime(mime)

  if (mime.startsWith('image/') && mime !== 'image/gif' && mime !== 'image/svg+xml') {
    if (file.size <= max) return file
    return compressImage(file, max)
  }

  if (file.size > max) {
    throw new MediaUploadError('mediaFileTooLarge', { max: formatBytes(max) })
  }
  return file
}

export function fileExtension(name: string) {
  const m = name.match(/\.([^.]+)$/)
  return m ? m[1].toUpperCase() : 'FILE'
}
