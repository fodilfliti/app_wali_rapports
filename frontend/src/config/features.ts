/** Flip to true to re-enable document template create/import/config UI. Backend stays available either way. */
export const ENABLE_DOCUMENT_TEMPLATES = false

/**
 * Flip to true to show French content-value inputs again.
 * UI language FR toggle is independent — see spec/CORE.md § Bilingual content fields.
 */
export const ENABLE_FR_VALUE_INPUTS = false

/**
 * Flip to true to show admin service folder create / parent-folder picker.
 * When false, creates are always root leaves (`is_folder: false`).
 */
export const ENABLE_SERVICE_FOLDERS = false

/**
 * Flip to false to hide guide-videos hub tiles and routes.
 * Backend API stays available either way.
 */
export const ENABLE_GUIDE_VIDEOS = true

/** Client-side ffmpeg.wasm video re-encode before upload (guide videos + rapport videos). */
export const ENABLE_CLIENT_VIDEO_TRANSCODE = false

/** Content field locale for editors: always Arabic when FR value inputs are hidden. */
export function contentLocale(uiLang?: string | null): 'ar' | 'fr' {
  if (!ENABLE_FR_VALUE_INPUTS) return 'ar'
  return uiLang === 'fr' ? 'fr' : 'ar'
}
