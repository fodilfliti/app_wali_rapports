import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'
import { HubTile } from './HubTile'
import { HubCountBadge } from './HubCountBadge'
import { TablePagination } from './TablePagination'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import {
  localizedRapportTypeName,
  officeRapportTypePath,
  rapportTypeHubIcon,
  sortRapportTypesForDisplay,
  type RapportTypeNav,
  waliRapportTypeListPath,
} from '../utils/rapportNavigation'

type Props = {
  service: { id: number; name_ar?: string; name_fr?: string }
  rapportTypes: RapportTypeNav[]
  accessLevel?: string
  backTo: string
  mode: 'office' | 'wali'
  waliUserId?: number
  showConfig?: boolean
  pageTitle?: string
}

export function ServiceRapportTypesHub({
  service,
  rapportTypes,
  accessLevel,
  backTo,
  mode,
  waliUserId,
  showConfig,
  pageTitle,
}: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const serviceLabel = i18n.language === 'fr' ? service.name_fr : service.name_ar
  const heading = pageTitle || serviceLabel || t('navServices')
  const sorted = sortRapportTypesForDisplay(rapportTypes, i18n.language)
  const pagedTypes = paginateSlice(sorted, page, DEFAULT_PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [service.id, rapportTypes.length])

  return (
    <div className="page">
      <div className="pageHeader row">
        <div className="hubPageHeading">
          <h1>{heading}</h1>
          {pageTitle ? <p className="muted small hubLevelHint">{serviceLabel}</p> : null}
        </div>
        {mode === 'office' && accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        {mode === 'office' && showConfig ? (
          <Link className="btn btn-secondary" to={`/office/services/${service.id}/config`}>
            {t('serviceConfig')}
          </Link>
        ) : null}
        <BackButton fallbackTo={backTo} />
      </div>
      <div className="hubGrid hubGridServices">
        {pagedTypes.map((rt) => (
          <HubTile
            key={rt.id}
            to={
              mode === 'office'
                ? officeRapportTypePath(service.id, rt)
                : waliUserId
                  ? waliRapportTypeListPath(waliUserId, service.id, rt)
                  : '#'
            }
            icon={rapportTypeHubIcon(rt.content_kind)}
            title={localizedRapportTypeName(rt, i18n.language)}
            badge={
              Number(rt.action_count) > 0 ? <HubCountBadge count={Number(rt.action_count)} /> : undefined
            }
          />
        ))}
      </div>
      {!sorted.length ? <p className="muted">{t('noResults')}</p> : null}
      <TablePagination page={page} total={sorted.length} onPageChange={setPage} />
    </div>
  )
}
