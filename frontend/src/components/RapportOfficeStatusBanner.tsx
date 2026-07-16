import { useTranslation } from 'react-i18next'

type Props = {
  rapport: {
    id: number
    status: string
    hidden_at?: string | null
  }
  editable: boolean
  /** Kept for call-site compatibility; hide/finish is not offered while awaiting validation. */
  onFinish?: () => void | Promise<void>
  finishing?: boolean
}

export function RapportOfficeStatusBanner({ rapport, editable }: Props) {
  const { t } = useTranslation()
  if (editable || !rapport?.id) return null

  if (rapport.status === 'pending_chef') {
    return (
      <div className="card rapportOfficeStatusBanner">
        <div className="rapportOfficeStatusBannerBody">
          <strong className="rapportOfficeStatusBannerTitle">{t('rapportAwaitingChefTitle')}</strong>
          <p className="muted small">{t('rapportAwaitingChefHint')}</p>
        </div>
      </div>
    )
  }

  if (rapport.status === 'submitted' || rapport.status === 'under_review') {
    return (
      <div className="card rapportOfficeStatusBanner">
        <div className="rapportOfficeStatusBannerBody">
          <strong className="rapportOfficeStatusBannerTitle">{t('rapportAwaitingWaliTitle')}</strong>
          <p className="muted small">{t('rapportAwaitingWaliHint')}</p>
        </div>
      </div>
    )
  }

  return null
}
