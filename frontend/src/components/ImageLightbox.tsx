import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
}

export function ImageLightbox({ src, alt = '', open, onClose }: Props) {
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

  return (
    <div
      className="imageLightboxBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={alt || t('mediaImagePreview')}
      onClick={onClose}
    >
      <div className="imageLightboxPanel" onClick={(e) => e.stopPropagation()}>
        <div className="imageLightboxToolbar">
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        <div className="imageLightboxBody">
          <img
            className="imageLightboxImage"
            src={src}
            alt={alt}
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}

export function useImageLightbox() {
  const [state, setState] = useState<{ src: string; alt: string } | null>(null)
  const open = useCallback((src: string, alt = '') => {
    if (!src) return
    setState({ src, alt })
  }, [])
  const close = useCallback(() => setState(null), [])
  return { state, open, close, isOpen: Boolean(state) }
}
