/** API root — empty in dev uses Vite proxy (same origin, no CORS issues). */
export function getApiBase(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return 'http://localhost:4001'
}
