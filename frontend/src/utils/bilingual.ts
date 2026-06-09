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
