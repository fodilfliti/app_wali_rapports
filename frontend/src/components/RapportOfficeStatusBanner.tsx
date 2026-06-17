import { useTranslation } from 'react-i18next'
import {
  canFinishRapport,
  isAwaitingWaliResponse,
} from '../utils/rapportNavigation'

type Props = {
  rapport: {
    id: number
    status: string
    hidden_at?: string | null
  }
  editable: boolean
  onFinish?: () => void | Promise<void>
  finishing?: boolean
}

export function RapportOfficeStatusBanner({
  rapport,
  editable,
  onFinish,
  finishing = false,
}: Props) {
  const { t } = useTranslation()
  if (editable || !rapport?.id) return null

  const awaiting = isAwaitingWaliResponse(rapport.status)
  const canFinish = canFinishRapport(rapport.status) && !rapport.hidden_at && onFinish

  if (!awaiting && !canFinish) return null

  return (
    <div className="card rapportOfficeStatusBanner">
      <div className="rapportOfficeStatusBannerBody">
        {awaiting ? (
          <>
            <strong className="rapportOfficeStatusBannerTitle">{t('rapportAwaitingWaliTitle')}</strong>
            <p className="muted small">{t('rapportAwaitingWaliHint')}</p>
          </>
        ) : (
          <>
            <strong className="rapportOfficeStatusBannerTitle">{t('rapportFinishHintTitle')}</strong>
            <p className="muted small">{t('rapportFinishHint')}</p>
          </>
        )}
      </div>
      {canFinish ? (
        <div className="rapportOfficeStatusBannerActions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={finishing}
            onClick={() => onFinish?.()}
          >
            {t('finishRapport')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
