import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type MediaLightboxKind = 'image' | 'video'

type Props = {
  src: string
  alt?: string
  kind?: MediaLightboxKind
  open: boolean
  onClose: () => void
}

export function ImageLightbox({ src, alt = '', kind = 'image', open, onClose }: Props) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!open) setZoom(1)
  }, [open, src])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !src) return null

  const isVideo = kind === 'video'

  return (
    <div
      className="imageLightboxBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={alt || (isVideo ? t('mediaVideoPreview') : t('mediaImagePreview'))}
      onClick={onClose}
    >
      <div
        className={`imageLightboxPanel${isVideo ? ' imageLightboxPanel-video' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="imageLightboxToolbar">
          {!isVideo ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                aria-label={t('zoomOut')}
              >
                −
              </button>
              <span className="imageLightboxZoomLabel">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                aria-label={t('zoomIn')}
              >
                +
              </button>
            </>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        <div className="imageLightboxBody">
          {isVideo ? (
            <video
              className="imageLightboxVideo"
              src={src}
              controls
              autoPlay
              playsInline
            />
          ) : (
            <img
              className="imageLightboxImage"
              src={src}
              alt={alt}
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function useImageLightbox() {
  const [state, setState] = useState<{
    src: string
    alt: string
    kind: MediaLightboxKind
  } | null>(null)

  const open = useCallback((src: string, alt = '', kind: MediaLightboxKind = 'image') => {
    if (!src) return
    setState({ src, alt, kind })
  }, [])

  const openVideo = useCallback((src: string, alt = '') => {
    if (!src) return
    setState({ src, alt, kind: 'video' })
  }, [])

  const close = useCallback(() => setState(null), [])

  return {
    state,
    open,
    openVideo,
    close,
    isOpen: Boolean(state),
  }
}
