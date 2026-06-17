import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'
import { HubCountBadge } from './HubCountBadge'
import { HubTileWithMenu } from './HubTileWithMenu'
import { RapportListScopeFilter } from './RapportListScopeFilter'
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
  manageTypes?: boolean
  showHiddenTypes?: boolean
  onShowHiddenTypesChange?: (showHidden: boolean) => void
  onHideType?: (typeId: number) => void | Promise<void>
  onRestoreType?: (typeId: number) => void | Promise<void>
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
  manageTypes,
  showHiddenTypes = false,
  onShowHiddenTypesChange,
  onHideType,
  onRestoreType,
}: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const serviceLabel = i18n.language === 'fr' ? service.name_fr : service.name_ar
  const heading = pageTitle || serviceLabel || t('navServices')
  const sorted = sortRapportTypesForDisplay(rapportTypes, i18n.language)
  const pagedTypes = paginateSlice(sorted, page, DEFAULT_PAGE_SIZE)
  const canManageTypes = mode === 'office' && manageTypes && accessLevel === 'manage'

  useEffect(() => {
    setPage(1)
  }, [service.id, rapportTypes.length, showHiddenTypes])

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
        <BackButton to={backTo} fallbackTo={backTo} replace />
      </div>

      {canManageTypes && onShowHiddenTypesChange ? (
        <div className="rapportListToolbar">
          <RapportListScopeFilter
            showHidden={showHiddenTypes}
            onChange={onShowHiddenTypesChange}
            scopeLabelKey="rapportTypeListScope"
            activeLabelKey="rapportTypeListVisible"
            hiddenLabelKey="rapportTypeListHidden"
            ariaLabelKey="showHiddenRapportTypes"
          />
        </div>
      ) : null}

      <div className="hubGrid hubGridServices">
        {pagedTypes.map((rt) => (
          <HubTileWithMenu
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
            dimmed={Boolean(rt.hidden_at)}
            rapportType={rt}
            canManageType={canManageTypes}
            onHideType={onHideType}
            onRestoreType={onRestoreType}
            badge={
              Number(rt.action_count) > 0 ? (
                <HubCountBadge count={Number(rt.action_count)} />
              ) : undefined
            }
          />
        ))}
      </div>
      {!sorted.length ? <p className="muted">{t('noResults')}</p> : null}
      <TablePagination page={page} total={sorted.length} onPageChange={setPage} />
    </div>
  )
}
