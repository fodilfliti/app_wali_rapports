import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArchiveVersionsLink } from '../pages/RapportVersionsArchivePage'
import {
  latestSubmittedVersion,
  supportsRapportVersionArchive,
} from '../utils/rapportNavigation'
import { versionDetailPath } from '../utils/rapportVersionsNav'

import type { EntityIdParam } from '../api'

type VersionRow = { id: EntityIdParam; version_number: number; submitted_at?: string | null }

type Props = {
  rapportId: EntityIdParam
  rapportType?: { versioning_mode?: string } | null
  versions?: VersionRow[]
  wali?: boolean
  chef?: boolean
  showSentVersion?: boolean
  className?: string
}

export function RapportVersionHeaderActions({
  rapportId,
  rapportType,
  versions = [],
  wali = false,
  chef = false,
  showSentVersion = false,
  className = 'btn btn-secondary',
}: Props) {
  const { t } = useTranslation()

  if (!supportsRapportVersionArchive(rapportType, versions)) return null

  const sent = latestSubmittedVersion(versions)

  return (
    <>
      {showSentVersion && sent ? (
        <Link
          className={className}
          to={versionDetailPath(rapportId, sent.id, wali, chef)}
        >
          {t('viewSentVersion', { version: sent.version_number })}
        </Link>
      ) : null}
      <ArchiveVersionsLink
        rapportId={rapportId}
        wali={wali}
        chef={chef}
        className={className}
      />
    </>
  )
}
