import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
} from '../api'

export type PushEnsureStatus =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported'
  | 'needs_browser_reset'
  | 'unavailable'

export type PushEnsureResult = { status: PushEnsureStatus }

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function subscriptionKeysOk(sub: PushSubscription): boolean {
  const json = sub.toJSON()
  return Boolean(json.endpoint && json.keys?.p256dh && json.keys?.auth)
}

function isBrowserResetError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name?: string }).name) : ''
  return name === 'NotAllowedError' || name === 'AbortError'
}

async function subscribeFresh(
  reg: ServiceWorkerRegistration,
  token: string,
): Promise<PushSubscription> {
  const { publicKey } = await getVapidPublicKey(token)
  if (!publicKey) throw new Error('pushNotConfigured')
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerAppServiceWorker() {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

/** True when this browser already has a PushManager subscription (may or may not be on server). */
export async function hasLocalPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return Boolean(sub)
  } catch {
    return false
  }
}

export async function ensurePushSubscription(token: string): Promise<PushEnsureResult> {
  if (!pushSupported()) return { status: 'unsupported' }

  const registration = await registerAppServiceWorker()
  if (!registration) return { status: 'unavailable' }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
  if (permission !== 'granted') return { status: permission }

  let reg: ServiceWorkerRegistration
  try {
    reg = await navigator.serviceWorker.ready
  } catch {
    return { status: 'unavailable' }
  }

  try {
    let sub = await reg.pushManager.getSubscription()

    if (sub && !subscriptionKeysOk(sub)) {
      await sub.unsubscribe().catch(() => {})
      sub = null
    }

    if (!sub) {
      try {
        sub = await subscribeFresh(reg, token)
      } catch (err) {
        if (isBrowserResetError(err)) return { status: 'needs_browser_reset' }
        throw err
      }
    }

    if (!subscriptionKeysOk(sub)) {
      await sub.unsubscribe().catch(() => {})
      try {
        sub = await subscribeFresh(reg, token)
      } catch (err) {
        if (isBrowserResetError(err)) return { status: 'needs_browser_reset' }
        throw err
      }
    }

    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { status: 'unavailable' }
    }

    await subscribePush(token, {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    })
    return { status: 'granted' }
  } catch (err) {
    if (isBrowserResetError(err) && Notification.permission === 'granted') {
      return { status: 'needs_browser_reset' }
    }
    // Stale sub / VAPID mismatch: drop local and retry once
    try {
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe().catch(() => {})
      const sub = await subscribeFresh(reg, token)
      const json = sub.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return { status: 'unavailable' }
      }
      await subscribePush(token, {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      })
      return { status: 'granted' }
    } catch (retryErr) {
      if (isBrowserResetError(retryErr) && Notification.permission === 'granted') {
        return { status: 'needs_browser_reset' }
      }
      return { status: 'unavailable' }
    }
  }
}

/** Refresh server row for an existing local subscription only — never prompts or creates. */
export async function refreshExistingPushSubscription(token: string): Promise<boolean> {
  if (!pushSupported()) return false
  await registerAppServiceWorker()
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return false
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false
  await subscribePush(token, {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  })
  return true
}

export async function removePushSubscription(token: string) {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    try {
      await unsubscribePush(token, sub.endpoint)
    } catch {
      /* ignore */
    }
    await sub.unsubscribe().catch(() => {})
  }
}
