/** Keys owned by dedicated hub counters (instructions / shared files). */
export const DEDICATED_NOTIFICATION_KEYS = [
  'waliInstruction',
  'waliBroadcast',
  'waliBroadcastReminder',
] as const

export type DedicatedNotificationKey = (typeof DEDICATED_NOTIFICATION_KEYS)[number]

export function isDedicatedNotificationKey(key: string | null | undefined): boolean {
  return Boolean(key && (DEDICATED_NOTIFICATION_KEYS as readonly string[]).includes(key))
}
