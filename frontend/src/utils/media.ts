import { signFileUrl } from '../api'
import type { EntityIdParam } from '../api'

export type MediaFile = {
  id: EntityIdParam
  storage_key: string
  original_name: string
  mime_type: string
  size_bytes?: number
  media_kind: 'image' | 'video' | 'file'
  url_path: string
}

export type MediaRow = { items: { file_id: EntityIdParam }[] }

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

/** @deprecated use signFileUrl or useSignedFileUrl */
export async function fileUrl(_token: string, file: MediaFile | undefined | null) {
  if (!file?.url_path) return ''
  return signFileUrl(file.url_path)
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

export function flattenMediaRows(rows: MediaRow[] | undefined): EntityIdParam[] {
  const ids: EntityIdParam[] = []
  for (const row of rows || []) {
    for (const it of row.items || []) {
      if (it.file_id != null && it.file_id !== '') ids.push(it.file_id)
    }
  }
  return ids
}

export function mediaRowsFromFileIds(ids: EntityIdParam[]): MediaRow[] {
  const items = ids.filter((id) => id != null && id !== '').map((file_id) => ({ file_id }))
  return items.length ? [{ items }] : []
}

export function normalizeMediaRows(rows: MediaRow[] | undefined): MediaRow[] {
  return mediaRowsFromFileIds(flattenMediaRows(rows))
}

/** Resolve media file whether map is keyed by UUID or legacy BIGINT. */
export function lookupMediaFile(
  files: Record<string, MediaFile> | undefined | null,
  fileId: EntityIdParam | null | undefined,
): MediaFile | null {
  if (!files || fileId == null || fileId === '') return null
  return files[String(fileId)] ?? null
}

let worker: Worker | null = null
let workerJobId = 0

function getCompressWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    worker = new Worker(new URL('./imageCompress.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

function compressWithWorker(file: File, maxBytes: number): Promise<File> {
  const w = getCompressWorker()
  if (!w) return compressImageMainThread(file, maxBytes)

  const id = ++workerJobId
  const preferWebp = typeof createImageBitmap !== 'undefined'

  return new Promise((resolve, reject) => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as { id: number; ok: boolean; buffer?: ArrayBuffer; mime?: string; ext?: string; error?: string }
      if (data.id !== id) return
      w!.removeEventListener('message', onMessage)
      w!.removeEventListener('error', onError)
      if (data.ok && data.buffer && data.mime && data.ext) {
        const base = file.name.replace(/\.[^.]+$/, '') || 'image'
        resolve(new File([data.buffer], `${base}${data.ext}`, { type: data.mime }))
      } else if (data.error === 'mediaFileTooLarge') {
        reject(new MediaUploadError('mediaFileTooLarge', { max: formatBytes(maxBytes) }))
      } else {
        reject(new MediaUploadError(data.error || 'mediaImageReadFailed'))
      }
    }
    function onError() {
      w!.removeEventListener('message', onMessage)
      w!.removeEventListener('error', onError)
      compressImageMainThread(file, maxBytes).then(resolve).catch(reject)
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    file.arrayBuffer().then((buffer) => {
      w.postMessage(
        { id, buffer, mime: file.type, maxBytes, maxDim: 1920, preferWebp },
        [buffer],
      )
    }).catch(() => reject(new MediaUploadError('mediaImageReadFailed')))
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function compressImageMainThread(file: File, maxBytes: number): Promise<File> {
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

    const preferWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    const attempts: { type: string; ext: string; qualities: (number | undefined)[] }[] = preferWebp
      ? [
          { type: 'image/webp', ext: '.webp', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
          { type: 'image/jpeg', ext: '.jpg', qualities: [0.85, 0.75, 0.65, 0.55, 0.45] },
        ]
      : file.type === 'image/png'
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

async function compressImage(file: File, maxBytes: number): Promise<File> {
  return compressWithWorker(file, maxBytes)
}

export type PrepareFileOptions = {
  onCompressing?: () => void
}

export async function prepareFileForUpload(file: File, opts: PrepareFileOptions = {}): Promise<File> {
  const mime = file.type || 'application/octet-stream'
  const max = maxBytesForMime(mime)

  if (mime.startsWith('image/') && mime !== 'image/gif' && mime !== 'image/svg+xml') {
    if (file.size <= max && file.size <= max * 0.85) return file
    opts.onCompressing?.()
    return compressImage(file, max)
  }

  if (mime.startsWith('video/')) {
    const { prepareVideoForUpload } = await import('./videoTranscode')
    opts.onCompressing?.()
    return prepareVideoForUpload(file)
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

export type UploadedFileRef = MediaFile & { uploadComplete?: boolean }
