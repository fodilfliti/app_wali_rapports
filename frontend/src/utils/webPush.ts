import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
} from '../api'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
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

export async function ensurePushSubscription(token: string): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  await registerAppServiceWorker()
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
  if (permission !== 'granted') return permission

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { publicKey } = await getVapidPublicKey(token)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('pushSubscribeFailed')
  }
  await subscribePush(token, {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  })
  return 'granted'
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
