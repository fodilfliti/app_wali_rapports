import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { RapportExportPreviewModal } from './RapportExportPreviewModal'

type Props = {
  token: string
  rapportId: number
  wali?: boolean
  showHidden?: boolean
  /** Save draft before preview so export matches the editor */
  onPreparePreview?: () => Promise<void>
}

export function RapportExportButtons({
  token,
  rapportId,
  wali = false,
  showHidden = false,
  onPreparePreview,
}: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [open, setOpen] = useState(false)
  const [previewFormat, setPreviewFormat] = useState<'pdf' | 'docx' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const opts = { locale: i18n.language, wali, showHidden }

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function runWithPrepare(action: () => Promise<void>) {
    setOpen(false)
    try {
      if (onPreparePreview) await onPreparePreview()
      await action()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function openPreview(format: 'pdf' | 'docx') {
    try {
      if (onPreparePreview) await onPreparePreview()
      setOpen(false)
      setPreviewFormat(format)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  function exportPdf() {
    runWithPrepare(() => api.downloadRapportPdf(token, rapportId, opts))
  }

  function exportDocx() {
    runWithPrepare(() => api.downloadRapportDocx(token, rapportId, opts))
  }

  return (
    <>
      <div className="exportMenuWrap" ref={wrapRef}>
        <button type="button" className="btn btn-secondary exportMenuBtn" onClick={() => setOpen((v) => !v)}>
          {t('exportRapport')} ▾
        </button>
        {open ? (
          <div className="exportMenuPanel">
            <button type="button" className="exportMenuItem exportMenuItemPreview" onClick={() => openPreview('pdf')}>
              {t('previewPdf')}
            </button>
            <button type="button" className="exportMenuItem exportMenuItemPreview" onClick={() => openPreview('docx')}>
              {t('previewDocx')}
            </button>
            <span className="exportMenuDivider" />
            <button type="button" className="exportMenuItem btnPdf" onClick={exportPdf}>
              {t('exportPdf')}
            </button>
            <button type="button" className="exportMenuItem btnDocx" onClick={exportDocx}>
              {t('exportDocx')}
            </button>
          </div>
        ) : null}
      </div>

      {previewFormat ? (
        <RapportExportPreviewModal
          token={token}
          rapportId={rapportId}
          format={previewFormat}
          opts={opts}
          onClose={() => setPreviewFormat(null)}
          onDownload={() => {
            if (previewFormat === 'pdf') exportPdf()
            else exportDocx()
            setPreviewFormat(null)
          }}
        />
      ) : null}
    </>
  )
}

/** @deprecated use RapportExportButtons */
export const ExportPdfButton = RapportExportButtons
