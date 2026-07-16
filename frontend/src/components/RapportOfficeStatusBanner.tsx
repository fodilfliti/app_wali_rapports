import { useTranslation } from 'react-i18next'
import { canOfficeReturnToDraft } from '../utils/rapportNavigation'
import { ReturnRapportToDraftConfirm } from './ReturnRapportToDraftConfirm'
import { BusyButton } from './BusyButton'

type Props = {
  rapport: {
    id: number
    status: string
    hidden_at?: string | null
  }
  editable: boolean
  /** Éditeur (`manage`) — required to show return-to-draft. */
  canManage?: boolean
  onReturnToDraft?: () => void | Promise<void>
  returning?: boolean
  /** Kept for call-site compatibility; hide/finish is not offered while awaiting validation. */
  onFinish?: () => void | Promise<void>
  finishing?: boolean
}

export function RapportOfficeStatusBanner({
  rapport,
  editable,
  canManage,
  onReturnToDraft,
  returning,
}: Props) {
  const { t } = useTranslation()
  if (editable || !rapport?.id) return null

  const showReturn =
    canManage === true &&
    typeof onReturnToDraft === 'function' &&
    canOfficeReturnToDraft(rapport.status)

  const returnAction = showReturn ? (
    <ReturnRapportToDraftConfirm onConfirm={onReturnToDraft}>
      {(openConfirm) => (
        <BusyButton
          type="button"
          className="btn btn-secondary"
          onClick={openConfirm}
          busy={!!returning}
          busyLabel={t('loading')}
        >
          {t('returnToDraft')}
        </BusyButton>
      )}
    </ReturnRapportToDraftConfirm>
  ) : null

  if (rapport.status === 'pending_chef') {
    return (
      <div className="card rapportOfficeStatusBanner">
        <div className="rapportOfficeStatusBannerBody">
          <strong className="rapportOfficeStatusBannerTitle">{t('rapportAwaitingChefTitle')}</strong>
          <p className="muted small">{t('rapportAwaitingChefHint')}</p>
        </div>
        {returnAction ? (
          <div className="rapportOfficeStatusBannerActions">{returnAction}</div>
        ) : null}
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
        {returnAction ? (
          <div className="rapportOfficeStatusBannerActions">{returnAction}</div>
        ) : null}
      </div>
    )
  }

  return null
}
