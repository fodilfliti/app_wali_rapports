import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArchiveVersionsLink } from '../pages/RapportVersionsArchivePage'
import {
  canFinishRapport,
  isAwaitingWaliResponse,
} from '../utils/rapportNavigation'

type VersionRow = { id: number; version_number: number; submitted_at?: string | null }

type Props = {
  rapport: {
    id: number
    status: string
    current_version_id?: number | null
    hidden_at?: string | null
  }
  editable: boolean
  returnTo: string
  versions?: VersionRow[]
  onFinish?: () => void | Promise<void>
  finishing?: boolean
}

export function RapportOfficeStatusBanner({
  rapport,
  editable,
  returnTo,
  versions = [],
  onFinish,
  finishing = false,
}: Props) {
  const { t } = useTranslation()
  if (editable || !rapport?.id) return null

  const awaiting = isAwaitingWaliResponse(rapport.status)
  const canFinish = canFinishRapport(rapport.status) && !rapport.hidden_at && onFinish
  const currentVersion = versions.find((v) => v.id === rapport.current_version_id)
  const versionNum = currentVersion?.version_number || 1
  const versionViewPath = `/office/rapports/${rapport.id}/versions/${rapport.current_version_id}?returnTo=${encodeURIComponent(returnTo)}`

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
            <strong className="rapportOfficeStatusBannerTitle">{t('rapportReadOnlyTitle')}</strong>
            <p className="muted small">{t('rapportReadOnlyVersionHint')}</p>
          </>
        )}
      </div>
      <div className="rapportOfficeStatusBannerActions">
        {rapport.current_version_id ? (
          <Link className="btn btn-primary btn-sm" to={versionViewPath}>
            {t('viewSentVersion', { version: versionNum })}
          </Link>
        ) : null}
        {versions.length > 0 ? (
          <ArchiveVersionsLink
            rapportId={rapport.id}
            returnTo={returnTo}
            className="btn btn-secondary btn-sm"
          />
        ) : null}
        {canFinish ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={finishing}
            onClick={() => onFinish?.()}
          >
            {t('finishRapport')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
