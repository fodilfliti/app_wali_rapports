import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderAsync } from 'docx-preview'
import type { EntityIdParam } from '../api'
import * as api from '../api'
import type { RapportExportOpts } from '../api'

type PreviewFormat = 'pdf' | 'docx'

type Props = {
  token: string
  rapportId: EntityIdParam
  format: PreviewFormat
  opts: RapportExportOpts
  onClose: () => void
  onDownload: () => void
}

export function RapportExportPreviewModal({ token, rapportId, format, opts, onClose, onDownload }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docxPageCount, setDocxPageCount] = useState(0)
  const docxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function loadPdf() {
      setLoading(true)
      setError(false)
      setPdfUrl(null)
      setDocxPageCount(0)
      try {
        const blob = await api.fetchRapportPdfBlob(token, rapportId, opts)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadDocx() {
      setLoading(true)
      setError(false)
      setDocxPageCount(0)
      const el = docxRef.current
      if (!el) {
        setLoading(false)
        setError(true)
        return
      }
      el.innerHTML = ''
      try {
        const blob = await api.fetchRapportDocxBlob(token, rapportId, opts)
        if (cancelled) return
        await renderAsync(blob, el, undefined, {
          className: 'docx-export-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: false,
          renderFooters: false,
        })
        if (cancelled) return
        const pages = el.querySelectorAll('section.docx-export-preview')
        pages.forEach((page, index) => {
          const sheet = page as HTMLElement
          sheet.setAttribute('data-page-num', String(index + 1))
          const existing = sheet.querySelector('.exportPreviewDocxPageLabel')
          if (existing) existing.remove()
          const label = document.createElement('div')
          label.className = 'exportPreviewDocxPageLabel'
          label.textContent = t('exportPreviewPageLabel', { n: index + 1 })
          sheet.prepend(label)
        })
        setDocxPageCount(pages.length)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (format === 'pdf') loadPdf()
    else loadDocx()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [format, token, rapportId, opts.locale, opts.wali, opts.showHidden, t])

  const title = format === 'pdf' ? t('previewPdf') : t('previewDocx')

  return (
    <div className="modalOverlay exportPreviewOverlay">
      <div className="modalCard exportPreviewModal wide">
        <div className="exportPreviewHeader">
          <div>
            <h2>{title}</h2>
            <p className="muted small">{t('exportPreviewSavedNote')}</p>
            {format === 'docx' && docxPageCount > 0 ? (
              <p className="exportPreviewPageCount">{t('exportPreviewPageCount', { count: docxPageCount })}</p>
            ) : null}
            {format === 'docx' ? <p className="muted small">{t('exportPreviewDocxPaginationNote')}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </div>

        {loading ? <p className="muted exportPreviewLoading">{t('loading')}</p> : null}
        {error ? <p className="schemaPickError">{t('exportPreviewError')}</p> : null}

        {!loading && !error && format === 'pdf' && pdfUrl ? (
          <iframe className="exportPreviewFrame" title={title} src={pdfUrl} />
        ) : null}

        {format === 'docx' ? (
          <div className="exportPreviewDocxScroll" hidden={loading || error}>
            <div ref={docxRef} className="exportPreviewDocx" />
          </div>
        ) : null}

        <div className="modalActions">
          <button type="button" className="btn btn-primary" disabled={loading || error} onClick={onDownload}>
            {format === 'pdf' ? t('exportPdf') : t('exportDocx')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
