import { ENABLE_FR_VALUE_INPUTS } from '../config/features'

export function trimOrEmpty(value?: string | null): string {
  return (value ?? '').trim()
}

export function hasBilingualText(ar?: string | null, fr?: string | null): boolean {
  return Boolean(trimOrEmpty(ar) || trimOrEmpty(fr))
}

export function pickBilingualText(ar?: string | null, fr?: string | null, locale: string = 'ar'): string {
  const a = trimOrEmpty(ar)
  const f = trimOrEmpty(fr)
  return locale === 'fr' ? f || a : a || f
}

/**
 * Pair for API save. When FR value inputs are hidden, keep existing FR as-is
 * (do not copy AR→FR). When enabled, empty side mirrors the other.
 */
export function bilingualPairForSave(ar?: string | null, fr?: string | null): { ar: string; fr: string } {
  const a = trimOrEmpty(ar)
  const f = trimOrEmpty(fr)
  if (!ENABLE_FR_VALUE_INPUTS) {
    return { ar: a || f, fr: f }
  }
  return { ar: a || f, fr: f || a }
}
