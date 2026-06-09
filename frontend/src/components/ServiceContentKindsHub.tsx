import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'
import { HubTile } from './HubTile'
import { HubCountBadge } from './HubCountBadge'
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
}: Props) {
  const { t, i18n } = useTranslation()
  const serviceLabel = i18n.language === 'fr' ? service.name_fr : service.name_ar
  const byKind = Object.fromEntries(summaries.map((s) => [s.content_kind, s]))
  const ordered = CONTENT_KINDS_ORDER.map((kind) => byKind[kind]).filter(Boolean)

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
        <BackButton fallbackTo={backTo} />
      </div>

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
                  <HubTile
                    key={rt.id}
                    to={rapportTypePath(rt)}
                    icon={rapportTypeHubIcon(rt.content_kind)}
                    title={localizedRapportTypeName(rt, i18n.language)}
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
