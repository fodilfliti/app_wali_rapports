import { useTranslation } from 'react-i18next'
import {
  canOfficeReturnToDraft,
  canOfficeStartNewVersion,
} from '../utils/rapportNavigation'
import { ReturnRapportToDraftConfirm } from './ReturnRapportToDraftConfirm'
import { StartNewVersionConfirm } from './StartNewVersionConfirm'
import { BusyButton } from './BusyButton'

type Props = {
  rapport: {
    id: number
    status: string
    hidden_at?: string | null
    delete_requested?: boolean
    delete_requested_at?: string | null
    rapportType?: { versioning_mode?: string } | null
  } | null
  /** Fallback when rapport.rapportType is absent (workspace.rapportType). */
  versioningMode?: string | null
  editable: boolean
  /** Éditeur (`manage`) — required for return-to-draft / new version. */
  canManage?: boolean
  onReturnToDraft?: () => void | Promise<void>
  returning?: boolean
  onStartNewVersion?: () => void | Promise<void>
  startingNewVersion?: boolean
  /** Kept for call-site compatibility; hide/finish is not offered while awaiting validation. */
  onFinish?: () => void | Promise<void>
  finishing?: boolean
}

export function RapportOfficeStatusBanner({
  rapport,
  versioningMode,
  editable,
  canManage,
  onReturnToDraft,
  returning,
  onStartNewVersion,
  startingNewVersion,
}: Props) {
  const { t } = useTranslation()
  if (!rapport?.id) return null

  if (rapport.delete_requested || rapport.delete_requested_at) {
    return (
      <div className="card rapportOfficeStatusBanner">
        <div className="rapportOfficeStatusBannerBody">
          <strong className="rapportOfficeStatusBannerTitle">
            {t('deleteRapportAwaitingChefTitle')}
          </strong>
          <p className="muted small">{t('deleteRapportAwaitingChefHint')}</p>
        </div>
      </div>
    )
  }

  if (editable) return null

  const mode =
    versioningMode ||
    rapport.rapportType?.versioning_mode ||
    null

  const showReturn =
    canManage === true &&
    typeof onReturnToDraft === 'function' &&
    canOfficeReturnToDraft(rapport.status)

  const showNewVersion =
    canManage === true &&
    typeof onStartNewVersion === 'function' &&
    canOfficeStartNewVersion(rapport.status, mode)

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

  const newVersionAction = showNewVersion ? (
    <StartNewVersionConfirm onConfirm={onStartNewVersion}>
      {(openConfirm) => (
        <BusyButton
          type="button"
          className="btn btn-primary"
          onClick={openConfirm}
          busy={!!startingNewVersion}
          busyLabel={t('loading')}
        >
          {t('startNewVersion')}
        </BusyButton>
      )}
    </StartNewVersionConfirm>
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

  if (rapport.status === 'acknowledged') {
    const readOnlyHint = showNewVersion
      ? t('startNewVersionHint')
      : mode === 'versioned'
        ? t('rapportReadOnlyVersionHint')
        : t('rapportReadOnlyStandaloneHint')
    return (
      <div className="card rapportOfficeStatusBanner">
        <div className="rapportOfficeStatusBannerBody">
          <strong className="rapportOfficeStatusBannerTitle">{t('rapportReadOnlyTitle')}</strong>
          <p className="muted small">{readOnlyHint}</p>
        </div>
        {newVersionAction ? (
          <div className="rapportOfficeStatusBannerActions">{newVersionAction}</div>
        ) : null}
      </div>
    )
  }

  return null
}
