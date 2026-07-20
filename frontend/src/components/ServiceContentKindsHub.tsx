import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackButton } from './BackButton'
import { HubCountBadge } from './HubCountBadge'
import { HubTile } from './HubTile'
import { HubTileWithMenu } from './HubTileWithMenu'
import { RapportListScopeFilter } from './RapportListScopeFilter'
import {
  CONTENT_KINDS_ORDER,
  contentKindHubIcon,
  localizedRapportTypeName,
  rapportTypeHubIcon,
  rapportTypeHubKindClass,
  sortRapportTypesForDisplay,
  type RapportTypeNav,
} from '../utils/rapportNavigation'
import type { GuidedContentKind } from './CreateContentKindTypeModal'
import { RapportKindsExplainer } from './RapportKindsExplainer'
import { RapportEditorsExplainer } from './RapportEditorsExplainer'

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
  onDeleteType?: (typeId: number) => void | Promise<void>
  onAddKind?: (kind: GuidedContentKind) => void
  onBrowseSchemas?: () => void
}

const ADDABLE_KINDS = new Set<string>(['document_compose', 'table_grid', 'commune_list'])

const ADD_LABEL_KEY: Record<string, string> = {
  document_compose: 'hubAddDocument',
  table_grid: 'hubAddTable',
  commune_list: 'hubAddListe',
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
  onDeleteType,
  onAddKind,
  onBrowseSchemas,
}: Props) {
  const { t, i18n } = useTranslation()
  const [explainerOpen, setExplainerOpen] = useState(false)
  const [editorsExplainerOpen, setEditorsExplainerOpen] = useState(false)
  const serviceLabel = i18n.language === 'fr' ? service.name_fr : service.name_ar
  const byKind = Object.fromEntries(summaries.map((s) => [s.content_kind, s]))
  const canManageTypes = mode === 'office' && manageTypes && accessLevel === 'manage'
  const totalActionCount = CONTENT_KINDS_ORDER.reduce((sum, kind) => {
    const s = byKind[kind]
    return sum + (Number(s?.action_count) || 0)
  }, 0)

  const kindsToShow = CONTENT_KINDS_ORDER.filter((kind) => {
    const types = contentKinds[kind] || []
    if (types.length) return true
    if (canManageTypes && ADDABLE_KINDS.has(kind)) return true
    return false
  })

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{serviceLabel || t('navServices')}</h1>
        {mode === 'office' && accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <button type="button" className="btn btn-secondary" onClick={() => setExplainerOpen(true)}>
          {t('kindsExplainerOpen')}
        </button>
        {mode === 'office' ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditorsExplainerOpen(true)}
          >
            {t('editorsExplainerOpen')}
          </button>
        ) : null}
        {mode === 'office' && showConfig ? (
          <Link className="btn btn-secondary" to={`/office/services/${service.id}/config`}>
            {t('serviceConfig')}
          </Link>
        ) : null}
        <BackButton to={backTo} fallbackTo={backTo} replace />
      </div>

      {mode === 'office' && totalActionCount > 0 ? (
        <p className="serviceActionHint" role="status">
          {t('serviceActionHint')}
        </p>
      ) : null}

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

      {!kindsToShow.length ? <p className="muted">{t('noResults')}</p> : null}

      <div className="serviceRapportSections">
        {kindsToShow.map((kind) => {
          const summary = byKind[kind]
          const types = sortRapportTypesForDisplay(contentKinds[kind] || [], i18n.language)
          const showAdd = canManageTypes && ADDABLE_KINDS.has(kind) && onAddKind

          return (
            <section key={kind} className="serviceRapportSection">
              <div className="serviceRapportSectionHeader">
                <div className="serviceRapportSectionHeading">
                  <div className="serviceRapportSectionTitleRow">
                    <h2 className="serviceRapportSectionTitle">{t(`contentKind_${kind}`)}</h2>
                    {Number(summary?.action_count) > 0 ? (
                      <HubCountBadge count={Number(summary.action_count)} variant="inline" />
                    ) : null}
                  </div>
                  <p className="muted small serviceRapportSectionHint">{t(`contentKindSectionHint_${kind}`)}</p>
                </div>
                {canManageTypes && kind === 'table_grid' && onBrowseSchemas ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onBrowseSchemas}
                  >
                    {t('schemaBrowserOpen')}
                  </button>
                ) : null}
              </div>
              <div className="hubGrid hubGridServices serviceRapportSectionGrid">
                {types.map((rt) => (
                  <HubTileWithMenu
                    key={rt.id}
                    to={rapportTypePath(rt)}
                    icon={rapportTypeHubIcon(rt)}
                    title={localizedRapportTypeName(rt, i18n.language)}
                    dimmed={Boolean(rt.hidden_at)}
                    rapportType={rt}
                    canManageType={canManageTypes}
                    onHideType={onHideType}
                    onRestoreType={onRestoreType}
                    onDeleteType={onDeleteType}
                    className={rapportTypeHubKindClass(rt)}
                    badge={
                      Number(rt.action_count) > 0 ? (
                        <HubCountBadge count={Number(rt.action_count)} />
                      ) : undefined
                    }
                  />
                ))}
                {showAdd ? (
                  <div className="hubTileCard hubTileCard--add">
                    <HubTile
                      icon={contentKindHubIcon(kind)}
                      title={t(ADD_LABEL_KEY[kind])}
                      className="hubTile--add"
                      onClick={() => onAddKind(kind as GuidedContentKind)}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

      {explainerOpen ? (
        <div
          className="modalOverlay"
          role="presentation"
          onClick={() => setExplainerOpen(false)}
        >
          <div
            className="modalCard wide kindsExplainerModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kindsExplainerTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <RapportKindsExplainer bare />
            <div className="modalActions">
              <button type="button" className="btn btn-secondary" onClick={() => setExplainerOpen(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editorsExplainerOpen ? (
        <div
          className="modalOverlay"
          role="presentation"
          onClick={() => setEditorsExplainerOpen(false)}
        >
          <div
            className="modalCard wide kindsExplainerModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editorsExplainerTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <RapportEditorsExplainer bare />
            <div className="modalActions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditorsExplainerOpen(false)}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
