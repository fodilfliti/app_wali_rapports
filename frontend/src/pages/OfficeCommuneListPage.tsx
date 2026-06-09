import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { BackButton } from '../components/BackButton'
import { HubTile } from '../components/HubTile'
import { RapportTitleField, patchRapportTitle } from '../components/RapportTitleField'
import { TablePagination } from '../components/TablePagination'
import { WaliResponsesSection } from '../components/WaliResponsesSection'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { localizedRapportTypeName, officeCommuneEditorPath } from '../utils/rapportNavigation'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'

type Props = { token: string }

type FilterMode = 'all' | 'filled' | 'empty'

export function OfficeCommuneListPage({ token }: Props) {
  const { serviceId } = useParams()
  const [searchParams] = useSearchParams()
  const rapportTypeId = searchParams.get('rapport_type_id') ? Number(searchParams.get('rapport_type_id')) : undefined
  const rapportId = searchParams.get('rapport_id') ? Number(searchParams.get('rapport_id')) : undefined
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [workspace, setWorkspace] = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [municipalitySearch, setMunicipalitySearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [title, setTitle] = useState('')
  const [page, setPage] = useState(1)

  const loadWorkspace = useCallback(async () => {
    if (!sid) return
    setLoading(true)
    setLoadError(null)
    try {
      const ws = await api.getCommuneWorkspace(token, sid, { rapportTypeId, rapportId })
      setWorkspace(ws)
      setTitle(ws.rapport?.title || '')
    } catch (e) {
      setWorkspace(null)
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      setLoadError(msg)
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, sid, rapportTypeId, rapportId, snack, t])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  const municipalities = useMemo(() => {
    const list = workspace?.municipalities || []
    const q = municipalitySearch.trim().toLowerCase()
    return list.filter((m: any) => {
      if (filter === 'filled' && !m.filled) return false
      if (filter === 'empty' && m.filled) return false
      if (!q) return true
      const name = `${m.name_ar || ''} ${m.name_fr || ''} ${m.code || ''}`.toLowerCase()
      return name.includes(q)
    })
  }, [workspace?.municipalities, municipalitySearch, filter])

  useEffect(() => {
    setPage(1)
  }, [municipalitySearch, filter])

  const pagedMunicipalities = paginateSlice(municipalities, page, DEFAULT_PAGE_SIZE)

  const filledCount = (workspace?.municipalities || []).filter((m: any) => m.filled).length
  const totalCount = workspace?.municipalities?.length || 0

  async function submitAll() {
    if (!workspace?.rapport?.id) return
    try {
      await patchRapportTitle(token, workspace.rapport.id, title)
      await api.submitRapport(token, workspace.rapport.id)
      notifyHubCountsRefresh()
      snack.show(t('submitRapport'), 'success')
      loadWorkspace()
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
    }
  }

  const editable = workspace?.editable === true

  const label = workspace?.rapportType
    ? localizedRapportTypeName(workspace.rapportType, i18n.language)
    : workspace?.service
      ? i18n.language === 'fr'
        ? workspace.service.name_fr
        : workspace.service.name_ar
      : t('contentKind_commune_list')

  return (
    <div className="page communeHubPage">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={label}
        />
        {editable ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
            if (!workspace?.rapport?.id) return
            try {
              const patched = await patchRapportTitle(token, workspace.rapport.id, title)
              setTitle(patched.title)
              snack.show(t('save'), 'success')
            } catch (e) {
              const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
              snack.show(t(msg), 'error')
            }
          }}>
            {t('save')}
          </button>
        ) : null}
        {editable ? (
          <button type="button" className="btn btn-accent" onClick={submitAll}>
            {t('submitRapport')}
          </button>
        ) : null}
        {workspace?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      {loading ? <p className="muted communeStatus">{t('loading')}</p> : null}
      {loadError ? (
        <div className="communeError card">
          <p>{loadError === 'tableSchemaNotConfigured' ? t('tableSchemaNotConfigured') : t('communeWorkspaceError')}</p>
          {loadError === 'tableSchemaNotConfigured' ? (
            <Link className="btn btn-primary" to={`/office/services/${sid}/config`}>
              {t('goToServiceConfig')}
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={loadWorkspace}>
              {t('refresh')}
            </button>
          )}
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <div className="communeHubToolbar card">
            <input
              type="search"
              className="communeSearch"
              value={municipalitySearch}
              onChange={(e) => setMunicipalitySearch(e.target.value)}
              placeholder={t('communeSearchPlaceholder')}
            />
            <div className="communeFilterRow">
              {(['all', 'filled', 'empty'] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn-secondary btn-sm${filter === mode ? ' active' : ''}`}
                  onClick={() => setFilter(mode)}
                >
                  {t(`communeFilter_${mode}`)}
                </button>
              ))}
            </div>
            <p className="muted small communeProgress">
              {t('communeProgress', { filled: filledCount, total: totalCount })}
            </p>
          </div>

          <div className="hubGrid communeHubGrid">
            {pagedMunicipalities.map((m: any) => {
              const name = i18n.language === 'fr' ? m.name_fr : m.name_ar
              return (
                <HubTile
                  key={m.code}
                  to={officeCommuneEditorPath(sid, m.code, {
                    rapportTypeId,
                    rapportId: workspace?.rapport?.id,
                  })}
                  icon="communes"
                  title={name}
                  subtitle={m.filled ? t('communeFilled') : t('communeEmpty')}
                  className={m.filled ? 'communeHubTileFilled' : 'communeHubTileEmpty'}
                  badge={
                    m.filled ? (
                      <span className="badge badge-submitted communeHubBadge">{t('communeFilled')}</span>
                    ) : null
                  }
                />
              )
            })}
          </div>
          {!municipalities.length ? <p className="muted communeEmptyHint">{t('noResults')}</p> : null}
          <TablePagination page={page} total={municipalities.length} onPageChange={setPage} />

          <WaliResponsesSection responses={workspace?.rapport?.waliResponses || []} />
        </>
      ) : null}
    </div>
  )
}
