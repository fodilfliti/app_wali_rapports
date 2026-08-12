import { getApiBase } from './apiBase'
import { getAccessToken, notifySessionExpired, refreshSession } from '../auth/session'
import { ApiError } from './apiError'

const API_BASE = getApiBase()

/** Bytes still transferring vs server-side verify (magic bytes + antivirus). */
export type UploadPhase = 'uploading' | 'scanning'

export type UploadProgress = {
  loaded: number
  total: number
  percent: number
  phase: UploadPhase
}

export type UploadOptions = {
  token?: string | null
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
  /** Abort upload after this many ms (uses signal + xhr.abort). */
  timeoutMs?: number
  /** Retry once on network failure (not 4xx). Default true. */
  retry?: boolean
}

function isAuthPath(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/logout')
  )
}

function parseJsonResponse(xhr: XMLHttpRequest): unknown {
  try {
    return JSON.parse(xhr.responseText || '{}')
  } catch {
    return {}
  }
}

function uploadOnce<T>(
  path: string,
  method: string,
  buildFormData: () => FormData,
  opts: UploadOptions & { token: string | null; _retried?: boolean },
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = buildFormData()

    if (opts.signal) {
      if (opts.signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      opts.signal.addEventListener('abort', () => xhr.abort())
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timeoutId = setTimeout(() => xhr.abort(), opts.timeoutMs)
    }

    const clearTimer = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }

    xhr.open(method, `${API_BASE}${path}`)
    xhr.withCredentials = true
    if (opts.token) xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`)

    let lastLoaded = 0
    let lastTotal = 0

    xhr.upload.onprogress = (ev) => {
      if (!opts.onProgress) return
      if (ev.lengthComputable) {
        lastLoaded = ev.loaded
        lastTotal = ev.total
        const percent = ev.total > 0 ? Math.round((ev.loaded / ev.total) * 100) : 0
        opts.onProgress({ loaded: ev.loaded, total: ev.total, percent, phase: 'uploading' })
      }
    }

    // Body fully sent; server may still validate + scan before responding.
    xhr.upload.onload = () => {
      if (!opts.onProgress) return
      const total = lastTotal > 0 ? lastTotal : lastLoaded
      opts.onProgress({
        loaded: lastLoaded || total,
        total: total || lastLoaded,
        percent: 100,
        phase: 'scanning',
      })
    }

    xhr.onload = () => {
      clearTimer()
      const data = parseJsonResponse(xhr) as Record<string, unknown>
      if (xhr.status === 401 && !opts._retried && !isAuthPath(path) && opts.token) {
        refreshSession()
          .then((refreshed) => {
            if (refreshed?.token) {
              return uploadOnce<T>(path, method, buildFormData, {
                ...opts,
                token: refreshed.token,
                _retried: true,
              })
            }
            notifySessionExpired()
            reject(new ApiError(401, String(data.error || 'errorGeneric')))
          })
          .catch(reject)
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T)
        return
      }
      reject(
        new ApiError(
          xhr.status,
          String(data.error || 'errorGeneric'),
          data.fieldErrors as Record<string, string> | undefined,
        ),
      )
    }

    xhr.onerror = () => {
      clearTimer()
      reject(new ApiError(0, 'errorGeneric'))
    }
    xhr.onabort = () => {
      clearTimer()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    xhr.send(formData)
  })
}

export async function uploadFormData<T>(
  path: string,
  buildFormData: () => FormData,
  opts: UploadOptions & { method?: string } = {},
): Promise<T> {
  const token = opts.token === null ? null : getAccessToken() || opts.token || null
  const method = opts.method || 'POST'
  const retry = opts.retry !== false

  try {
    return await uploadOnce<T>(path, method, buildFormData, { ...opts, token })
  } catch (err) {
    if (!retry || err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return uploadOnce<T>(path, method, buildFormData, { ...opts, token, retry: false })
  }
}
