import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'
import { HubCountBadge } from './HubCountBadge'
import { HubTileWithMenu } from './HubTileWithMenu'
import { RapportListScopeFilter } from './RapportListScopeFilter'
import {
  CONTENT_KINDS_ORDER,
  localizedRapportTypeName,
  rapportTypeHubIcon,
  sortRapportTypesForDisplay,
  type RapportTypeNav,
} from '../utils/rapportNavigation'

export type ContentKindSummary = {
  content_kind: string
  type_count: number
  action_count?: number
}

type Props = {
  service: { id: number; name_ar?: string; name_fr?: string }
  summaries: ContentKindSummary[]
  contentKinds?: Record<string, RapportTypeNav[]>
  backTo: string
  rapportTypePath: (rt: RapportTypeNav) => string
  mode: 'office' | 'wali'
  accessLevel?: string
  showConfig?: boolean
  manageTypes?: boolean
  showHiddenTypes?: boolean
  onShowHiddenTypesChange?: (showHidden: boolean) => void
  onHideType?: (typeId: number) => void | Promise<void>
  onRestoreType?: (typeId: number) => void | Promise<void>
}

export function ServiceContentKindsHub({
  service,
  summaries,
  contentKinds = {},
  backTo,
  rapportTypePath,
  mode,
  accessLevel,
  showConfig,
  manageTypes,
  showHiddenTypes = false,
  onShowHiddenTypesChange,
  onHideType,
  onRestoreType,
}: Props) {
  const { t, i18n } = useTranslation()
  const serviceLabel = i18n.language === 'fr' ? service.name_fr : service.name_ar
  const byKind = Object.fromEntries(summaries.map((s) => [s.content_kind, s]))
  const ordered = CONTENT_KINDS_ORDER.map((kind) => byKind[kind]).filter(Boolean)
  const canManageTypes = mode === 'office' && manageTypes && accessLevel === 'manage'

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{serviceLabel || t('navServices')}</h1>
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

      {!ordered.length ? <p className="muted">{t('noResults')}</p> : null}

      <div className="serviceRapportSections">
        {ordered.map((summary) => {
          const types = sortRapportTypesForDisplay(contentKinds[summary.content_kind] || [], i18n.language)
          if (!types.length) return null

          return (
            <section key={summary.content_kind} className="serviceRapportSection">
              <div className="serviceRapportSectionHeader">
                <h2 className="serviceRapportSectionTitle">{t(`contentKind_${summary.content_kind}`)}</h2>
                {Number(summary.action_count) > 0 ? (
                  <HubCountBadge count={Number(summary.action_count)} />
                ) : null}
              </div>
              <div className="hubGrid hubGridServices serviceRapportSectionGrid">
                {types.map((rt) => (
                  <HubTileWithMenu
                    key={rt.id}
                    to={rapportTypePath(rt)}
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
            </section>
          )
        })}
      </div>
    </div>
  )
}
