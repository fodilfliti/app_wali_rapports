import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = {
  token: string
  rapportId: number
  wali?: boolean
  showHidden?: boolean
}

export function RapportExportButtons({ token, rapportId, wali = false, showHidden = false }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()

  const opts = { locale: i18n.language, wali, showHidden }

  async function exportPdf() {
    try {
      await api.downloadRapportPdf(token, rapportId, opts)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function exportDocx() {
    try {
      await api.downloadRapportDocx(token, rapportId, opts)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <>
      <button type="button" className="btn btnPdf" onClick={exportPdf}>
        {t('exportPdf')}
      </button>
      <button type="button" className="btn btnDocx" onClick={exportDocx}>
        {t('exportDocx')}
      </button>
    </>
  )
}

/** @deprecated use RapportExportButtons */
export const ExportPdfButton = RapportExportButtons
