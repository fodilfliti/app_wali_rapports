import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { RapportListScopeFilter } from '../components/RapportListScopeFilter'
import { RapportTypeHideActions } from '../components/RapportTypeHideActions'
import { RapportRowHideActions } from '../components/RapportRowHideActions'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { DocumentTemplatePickModal } from '../components/DocumentTemplatePickModal'
import { ENABLE_DOCUMENT_TEMPLATES } from '../config/features'
import { TablePagination } from '../components/TablePagination'
import { WaliRespondModal } from '../components/WaliRespondModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import {
  canOfficeEditRapport,
  canOfficeReturnToDraft,
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  officeNewDocumentPath,
  officeRapportTypeWorkspacePath,
  officeRapportWorkspacePath,
  type RapportTypeNav,
} from '../utils/rapportNavigation'
import {
  markOfficeRapportOpened,
  patchRapportUnread,
  rapportNeedsAttention,
  rapportStatusLabel,
  chefCommentPreview,
  chefResponseLabel,
  waliCommentPreview,
  waliResponseLabel,
} from '../utils/officeRapportList'
import { RapportStatusFlowHelp } from '../components/RapportStatusFlowHelp'
import { waliInboxRowClass, waliCanRespondFromList } from '../utils/waliInboxList'
import { backNavigationState } from '../utils/navigationBack'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { useChefHubCounts, useOfficeHubCounts, useWaliHubCounts } from '../hooks/useHubCounts'
import { localizedName } from '../utils/schemaColumns'
import { RapportExportButtons } from '../components/ExportPdfButton'
import { BusyButton } from '../components/BusyButton'
import { ReturnRapportToDraftConfirm } from '../components/ReturnRapportToDraftConfirm'
import { PageLoading } from '../components/PageLoading'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'

type Props = { token: string }

function isDocumentKind(r: any) {
  return ['document_compose', 'fiche_lecture'].includes(r.rapportType?.content_kind)
}

function openOfficeRapport(
  token: string,
  rapportId: number,
  setRows: Dispatch<SetStateAction<any[]>>,
) {
  setRows((prev) => patchRapportUnread(prev, rapportId))
  void markOfficeRapportOpened(token, rapportId)
}

function OfficeRapportTitleCell({ r, t }: { r: any; t: (k: string) => string }) {
  const chefComment = chefCommentPreview(r)
  const waliComment = waliCommentPreview(r)
  return (
    <td className="rapportTitleCell">
      <div className="rapportRowTitleCell">
        <span className="rapportRowTitle">{r.title}</span>
        {r.has_unread_notification ? (
          <span className="badge badge-submitted rapportUnreadBadge">{t('unread')}</span>
        ) : null}
      </div>
      {chefComment || waliComment ? (
        <div className="rapportRowDetails">
          {chefComment ? (
            <p className="rapportWaliCommentPreview">
              <span className="rapportWaliCommentLabel">{t('chefResponseText')}:</span> {chefComment}
            </p>
          ) : null}
          {waliComment ? (
            <p className="rapportWaliCommentPreview">
              <span className="rapportWaliCommentLabel">{t('waliResponseText')}:</span> {waliComment}
            </p>
          ) : null}
        </div>
      ) : null}
    </td>
  )
}

function OfficeRapportStatusCell({ r, t }: { r: any; t: (k: string) => string }) {
  const chefLabel = chefResponseLabel(r, t)
  const chefDecision = r.latest_chef_response?.decision
  const waliLabel = waliResponseLabel(r, t)
  const waliDecision = r.latest_wali_response?.decision
  return (
    <td className="rapportStatusCell">
      <div className="rapportStatusStack">
        <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
        {chefLabel && chefDecision ? (
          <p className="rapportWaliStatusNote muted small">
            {t('chefResponseShort')}:{' '}
            <span className={`badge badge-wali-${chefDecision} rapportWaliDecisionBadge`}>{chefLabel}</span>
          </p>
        ) : null}
        {waliLabel && waliDecision ? (
          <p className="rapportWaliStatusNote muted small">
            {t('waliResponseShort')}:{' '}
            <span className={`badge badge-wali-${waliDecision} rapportWaliDecisionBadge`}>{waliLabel}</span>
          </p>
        ) : null}
      </div>
    </td>
  )
}

export function OfficeRapportsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const serviceId = searchParams.get('service_id') ? Number(searchParams.get('service_id')) : undefined
  const discussionView = searchParams.get('view') === 'discussion'
  const discussionTab = searchParams.get('tab') === 'all' ? 'all' : 'new'
  const discussionAll = discussionView && discussionTab === 'all'
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showHidden] = useState(false)
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [returningId, setReturningId] = useState<number | null>(null)
  const [importFor, setImportFor] = useState<{ rapportId: number; serviceId: number; typeId: number } | null>(
    null,
  )
  const { counts } = useOfficeHubCounts(token)
  const unreadDiscussion = counts.unread_discussion || 0
  const unreadLabel = unreadDiscussion > 99 ? '99+' : String(unreadDiscussion)

  useEffect(() => {
    setPage(1)
  }, [serviceId, showHidden, search, discussionView, discussionTab])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rapportsRes = await api.listOfficeRapports(token, {
        service_id: discussionView ? undefined : serviceId,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        search: search || undefined,
        hidden_only: discussionView ? false : showHidden,
        unread_discussion: discussionView && !discussionAll ? true : undefined,
        has_discussion: discussionAll ? true : undefined,
      })
      setRows(rapportsRes.rapports)
      setTotal(rapportsRes.total ?? rapportsRes.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, serviceId, page, search, showHidden, snack, t, discussionView, discussionAll])

  useEffect(() => {
    load()
  }, [load])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function setView(next: 'list' | 'discussion') {
    if (next === 'discussion') {
      setSearchParams({ view: 'discussion' }, { replace: true })
      return
    }
    const nextParams: Record<string, string> = {}
    if (serviceId) nextParams.service_id = String(serviceId)
    setSearchParams(nextParams, { replace: true })
  }

  function setDiscussionTab(next: 'new' | 'all') {
    setSearchParams(
      next === 'all' ? { view: 'discussion', tab: 'all' } : { view: 'discussion' },
      { replace: true },
    )
  }

  function formatLastComment(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  async function finishRapport(id: number) {
    try {
      await api.finishRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('finishRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapport(id: number) {
    try {
      await api.restoreRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    setSubmittingId(id)
    try {
      await api.submitRapport(token, id)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSubmittingId(null)
    }
  }

  async function returnToDraft(id: number) {
    setReturningId(id)
    try {
      await api.returnRapportToDraft(token, id)
      notifyHubCountsRefresh()
      snack.show(t('returnToDraftDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setReturningId(null)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{discussionView ? t('navDiscussion') : t('navRapports')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <section className="inboxFilterBar card" aria-label={t('inboxViewTabs')}>
        <div className="inboxFilterBarTop">
          <div className="inboxViewTabs inboxViewTabs--primary" role="tablist" aria-label={t('inboxViewTabs')}>
            <button
              type="button"
              role="tab"
              aria-selected={!discussionView}
              className={`inboxViewTab${!discussionView ? ' active' : ''}`}
              onClick={() => setView('list')}
            >
              {t('navRapports')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={discussionView}
              className={`inboxViewTab${discussionView ? ' active' : ''}`}
              onClick={() => setView('discussion')}
            >
              <span>{t('navDiscussion')}</span>
              {unreadDiscussion > 0 ? (
                <span
                  className="inboxTabCount"
                  aria-label={t('unreadDiscussionBellWithCount', { count: unreadDiscussion })}
                >
                  {unreadLabel}
                </span>
              ) : null}
            </button>
          </div>

          {discussionView ? (
            <div
              className="inboxViewTabs inboxViewTabs--segment"
              role="tablist"
              aria-label={t('discussionSubTabs')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={!discussionAll}
                className={`inboxViewTab${!discussionAll ? ' active' : ''}`}
                onClick={() => setDiscussionTab('new')}
              >
                <span>{t('discussionTabNew')}</span>
                {unreadDiscussion > 0 ? (
                  <span className="inboxTabCount inboxTabCount--soft">{unreadLabel}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={discussionAll}
                className={`inboxViewTab${discussionAll ? ' active' : ''}`}
                onClick={() => setDiscussionTab('all')}
              >
                {t('discussionTabAll')}
              </button>
            </div>
          ) : null}
        </div>

        <p className="inboxViewHint">
          {discussionView
            ? discussionAll
              ? t('discussionAllHint')
              : t('discussionInboxHint')
            : t('officeRapportsListHint')}
        </p>

        <form className="inboxFilterSearch" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="office-rapport-search">
            {t('search')}
          </label>
          <input
            id="office-rapport-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchRapportPlaceholder')}
          />
          <button type="submit" className="btn btn-secondary">
            {t('search')}
          </button>
        </form>
      </section>

      {loading ? <PageLoading /> : null}

      {ENABLE_DOCUMENT_TEMPLATES && importFor ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={importFor.serviceId}
          rapportTypeId={importFor.typeId}
          open={!!importFor}
          mode="import"
          onClose={() => setImportFor(null)}
          onSelect={async (templateId, mode) => {
            if (!templateId || !importFor) return
            const { rapportId } = importFor
            setImportFor(null)
            try {
              await api.applyDocumentTemplate(token, rapportId, templateId, mode || 'replace')
              snack.show(t('documentTemplateImported'), 'success')
              load()
            } catch {
              snack.show(t('errorGeneric'), 'error')
            }
          }}
        />
      ) : null}

      <div className={`card tableWrap${discussionView ? ' discussionInboxTable' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              {discussionView ? <th>{t('lastCommentAt')}</th> : <th>{t('rapportStatus')}</th>}
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const showUnreadBadge =
                discussionView && (discussionAll ? !!r.has_unread_discussion : true)
              const rowClass = discussionView
                ? [
                    showUnreadBadge ? 'discussionRow--unread' : '',
                    !showUnreadBadge ? 'discussionRow--read' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                : rapportNeedsAttention(r)
                  ? `rapportRowAttention${r.has_unread_notification ? ' rapportRowUnread' : ''}`
                  : undefined
              return (
                <tr key={r.id} className={rowClass || undefined}>
                  {discussionView ? (
                    <td className="rapportTitleCell">
                      <div className="rapportRowTitleCell">
                        <span className="rapportRowTitle">{r.title}</span>
                        {showUnreadBadge ? (
                          <span className="badge badge-submitted rapportUnreadBadge">
                            {t('unreadDiscussionBadge')}
                          </span>
                        ) : null}
                      </div>
                      {r.last_comment_at ? (
                        <p className="discussionRowMeta muted small">
                          {t('lastCommentAt')}: {formatLastComment(r.last_comment_at)}
                        </p>
                      ) : null}
                    </td>
                  ) : (
                    <OfficeRapportTitleCell r={r} t={t} />
                  )}
                  {discussionView ? (
                    <td className="discussionLastCommentCell">
                      <time dateTime={r.last_comment_at || undefined}>
                        {formatLastComment(r.last_comment_at)}
                      </time>
                    </td>
                  ) : (
                    <OfficeRapportStatusCell r={r} t={t} />
                  )}
                  <td className="actionsCell">
                    <div className="actionsCellInner">
                      {officeRapportWorkspacePath(r) ? (
                        <Link
                          className={`btn btn-sm ${
                            discussionView
                              ? 'btn-primary'
                              : canOfficeEditRapport(r.status)
                                ? 'btn-primary'
                                : 'btn-secondary'
                          }`}
                          to={officeRapportWorkspacePath(r)!}
                          onClick={() => openOfficeRapport(token, r.id, setRows)}
                        >
                          {discussionView
                            ? t('openDiscussion')
                            : canOfficeEditRapport(r.status)
                              ? t('edit')
                              : t('details')}
                        </Link>
                      ) : null}
                      {!discussionView &&
                      ENABLE_DOCUMENT_TEMPLATES &&
                      isDocumentKind(r) &&
                      canOfficeEditRapport(r.status) &&
                      r.service_id &&
                      r.rapport_type_id ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setImportFor({
                              rapportId: r.id,
                              serviceId: r.service_id,
                              typeId: r.rapport_type_id,
                            })
                          }
                        >
                          {t('documentTemplateImport')}
                        </button>
                      ) : null}
                      {!discussionView && canOfficeEditRapport(r.status) ? (
                        <BusyButton
                          type="button"
                          className="btn btn-accent btn-sm"
                          busy={submittingId === r.id}
                          busyLabel={t('submitting')}
                          onClick={() => submit(r.id)}
                        >
                          {t('submitRapport')}
                        </BusyButton>
                      ) : null}
                      {!discussionView && canOfficeReturnToDraft(r.status) ? (
                        <ReturnRapportToDraftConfirm onConfirm={() => returnToDraft(r.id)}>
                          {(openConfirm) => (
                            <BusyButton
                              type="button"
                              className="btn btn-secondary btn-sm"
                              busy={returningId === r.id}
                              busyLabel={t('loading')}
                              onClick={openConfirm}
                            >
                              {t('returnToDraft')}
                            </BusyButton>
                          )}
                        </ReturnRapportToDraftConfirm>
                      ) : null}
                      {!discussionView ? (
                        <RapportRowHideActions
                          rapport={r}
                          canManage
                          showHidden={showHidden}
                          onHide={() => finishRapport(r.id)}
                          onRestore={() => restoreRapport(r.id)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={3} className={discussionView ? 'discussionInboxEmptyCell' : undefined}>
                  {discussionView
                    ? discussionAll
                      ? t('discussionAllEmpty')
                      : t('discussionInboxEmpty')
                    : t('noResults')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      {!discussionView ? <RapportStatusFlowHelp variant="office" /> : null}
    </div>
  )
}

export function OfficeServiceRapportListPage({ token }: Props) {
  const { serviceId, rapportTypeId } = useParams()
  const sid = Number(serviceId)
  const typeId = Number(rapportTypeId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [hub, setHub] = useState<any>(null)
  const [rapportType, setRapportType] = useState<RapportTypeNav | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createPickOpen, setCreatePickOpen] = useState(false)
  const [importFor, setImportFor] = useState<{ rapportId: number; typeId: number } | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [returningId, setReturningId] = useState<number | null>(null)

  useEffect(() => {
    setPage(1)
  }, [sid, typeId, showHidden])

  const load = useCallback(async () => {
    if (!sid || !typeId) return
    setLoading(true)
    try {
      const [hubRes, rapportsRes] = await Promise.all([
        api.getServiceContentHub(token, sid),
        api.listOfficeRapports(token, {
          service_id: sid,
          rapport_type_id: typeId,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          hidden_only: showHidden,
        }),
      ])
      setHub(hubRes)
      const rt =
        hubRes.rapportTypes?.find((x: RapportTypeNav) => Number(x.id) === typeId) || null
      setRapportType(rt)
      setRows(rapportsRes.rapports)
      setTotal(rapportsRes.total ?? rapportsRes.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, sid, typeId, page, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function finishRapportRow(id: number) {
    try {
      await api.finishRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('finishRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapportRow(id: number) {
    try {
      await api.restoreRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId)
      notifyHubCountsRefresh()
      snack.show(t('hideRapportTypeDone'), 'success')
      navigate(`/office/services/${sid}`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportTypeDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    setSubmittingId(id)
    try {
      await api.submitRapport(token, id)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSubmittingId(null)
    }
  }

  async function returnToDraft(id: number) {
    setReturningId(id)
    try {
      await api.returnRapportToDraft(token, id)
      notifyHubCountsRefresh()
      snack.show(t('returnToDraftDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setReturningId(null)
    }
  }

  async function createDoc(templateId: number | null, skipDefault = false) {
    if (!rapportType) return
    navigate(
      officeNewDocumentPath(sid, {
        rapportTypeId: typeId,
        templateId,
        skipDefault: templateId == null && skipDefault,
      }),
    )
  }

  const canEdit = hub?.accessLevel === 'manage'
  const isDocKind =
    rapportType && ['document_compose', 'fiche_lecture'].includes(rapportType.content_kind)
  const pageTitle = rapportType
    ? localizedRapportTypeName(rapportType, i18n.language)
    : hub?.service
      ? i18n.language === 'fr'
        ? hub.service.name_fr
        : hub.service.name_ar
      : t('navRapports')

  if (loading) {
    return (
      <div className="page">
        <PageLoading />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <div className="hubPageHeading">
          <h1>{pageTitle}</h1>
          {rapportType ? (
            <p className="muted small hubLevelHint">
              {i18n.language === 'fr' ? hub?.service?.name_fr : hub?.service?.name_ar}
            </p>
          ) : null}
        </div>
        {hub?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        {canEdit && isDocKind ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              ENABLE_DOCUMENT_TEMPLATES ? setCreatePickOpen(true) : createDoc(null, true)
            }
          >
            {t('createRapport')}
          </button>
        ) : null}
        {canEdit && rapportType && isDirectWorkspaceKind(rapportType.content_kind) && !rows.length ? (
          <Link className="btn btn-primary" to={officeRapportTypeWorkspacePath(sid, rapportType)}>
            {t('createRapport')}
          </Link>
        ) : null}
        {canEdit && rapportType ? (
          <div className="pageHeaderActionsMenu">
            <RapportTypeHideActions
              rapportType={rapportType}
              canManage={canEdit}
              onHideType={hideTypeFromPage}
              onRestoreType={restoreTypeFromPage}
              variant="page"
            />
          </div>
        ) : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      <div className="rapportListToolbar">
        <RapportListScopeFilter showHidden={showHidden} onChange={setShowHidden} />
      </div>

      {ENABLE_DOCUMENT_TEMPLATES && createPickOpen && rapportType ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={typeId}
          open={createPickOpen}
          mode="create"
          onClose={() => setCreatePickOpen(false)}
          onSelect={(templateId) => {
            setCreatePickOpen(false)
            createDoc(templateId, templateId == null)
          }}
        />
      ) : null}

      {ENABLE_DOCUMENT_TEMPLATES && importFor ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={importFor.typeId}
          open={!!importFor}
          mode="import"
          onClose={() => setImportFor(null)}
          onSelect={async (templateId, mode) => {
            if (!templateId || !importFor) return
            const { rapportId } = importFor
            setImportFor(null)
            try {
              await api.applyDocumentTemplate(token, rapportId, templateId, mode || 'replace')
              snack.show(t('documentTemplateImported'), 'success')
              load()
            } catch {
              snack.show(t('errorGeneric'), 'error')
            }
          }}
        />
      ) : null}

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  rapportNeedsAttention(r)
                    ? `rapportRowAttention${r.has_unread_notification ? ' rapportRowUnread' : ''}`
                    : undefined
                }
              >
                <OfficeRapportTitleCell r={r} t={t} />
                <OfficeRapportStatusCell r={r} t={t} />
                <td className="actionsCell">
                  <div className="actionsCellInner">
                  {officeRapportWorkspacePath(r) || (rapportType && officeRapportTypeWorkspacePath(sid, rapportType, r.id)) ? (
                    <Link
                      className={`btn btn-sm ${canOfficeEditRapport(r.status) ? 'btn-primary' : 'btn-secondary'}`}
                      to={officeRapportWorkspacePath(r) || officeRapportTypeWorkspacePath(sid, rapportType!, r.id)}
                      onClick={() => openOfficeRapport(token, r.id, setRows)}
                    >
                      {canOfficeEditRapport(r.status) ? t('edit') : t('details')}
                    </Link>
                  ) : null}
                  {ENABLE_DOCUMENT_TEMPLATES &&
                  isDocumentKind(r) &&
                  canOfficeEditRapport(r.status) &&
                  canEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setImportFor({
                          rapportId: r.id,
                          typeId: r.rapport_type_id || typeId,
                        })
                      }
                    >
                      {t('documentTemplateImport')}
                    </button>
                  ) : null}
                  {canOfficeEditRapport(r.status) && canEdit ? (
                    <BusyButton
                      type="button"
                      className="btn btn-accent btn-sm"
                      busy={submittingId === r.id}
                      busyLabel={t('submitting')}
                      onClick={() => submit(r.id)}
                    >
                      {t('submitRapport')}
                    </BusyButton>
                  ) : null}
                  {canOfficeReturnToDraft(r.status) && canEdit ? (
                    <ReturnRapportToDraftConfirm onConfirm={() => returnToDraft(r.id)}>
                      {(openConfirm) => (
                        <BusyButton
                          type="button"
                          className="btn btn-secondary btn-sm"
                          busy={returningId === r.id}
                          busyLabel={t('loading')}
                          onClick={openConfirm}
                        >
                          {t('returnToDraft')}
                        </BusyButton>
                      )}
                    </ReturnRapportToDraftConfirm>
                  ) : null}
                  <RapportRowHideActions
                    rapport={r}
                    canManage={canEdit}
                    showHidden={showHidden}
                    onHide={() => finishRapportRow(r.id)}
                    onRestore={() => restoreRapportRow(r.id)}
                  />
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      <RapportStatusFlowHelp variant="office" />
    </div>
  )
}

export function WaliRapportsInboxPage({ token, reviewer = 'wali' }: Props & { reviewer?: import('../utils/reviewerMode').ReviewerMode }) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const discussionView = searchParams.get('view') === 'discussion'
  const discussionTab = searchParams.get('tab') === 'all' ? 'all' : 'new'
  const discussionAll = discussionView && discussionTab === 'all'
  const base = reviewer === 'chef' ? '/chef' : '/wali'
  const inboxPath = discussionView
    ? discussionAll
      ? `${base}/rapports?view=discussion&tab=all`
      : `${base}/rapports?view=discussion`
    : `${base}/rapports`
  const hubPath = base
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [respondId, setRespondId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const waliCounts = useWaliHubCounts(reviewer === 'wali' ? token : '')
  const chefCounts = useChefHubCounts(reviewer === 'chef' ? token : '')
  const unreadDiscussion =
    reviewer === 'chef'
      ? chefCounts.counts.unread_discussion || 0
      : waliCounts.counts.unread_discussion || 0
  const unreadLabel = unreadDiscussion > 99 ? '99+' : String(unreadDiscussion)

  useEffect(() => {
    setPage(1)
  }, [search, discussionView, discussionTab])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listRapports = reviewer === 'chef' ? api.listChefRapports : api.listWaliRapports
      const res = await listRapports(token, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        search: search || undefined,
        unread_discussion: discussionView && !discussionAll ? true : undefined,
        has_discussion: discussionAll ? true : undefined,
      })
      setRows(res.rapports)
      setTotal(res.total ?? res.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, page, search, snack, t, reviewer, discussionView, discussionAll])

  useEffect(() => {
    load()
  }, [load])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function setView(next: 'inbox' | 'discussion') {
    setSearchParams(next === 'discussion' ? { view: 'discussion' } : {}, { replace: true })
  }

  function setDiscussionTab(next: 'new' | 'all') {
    setSearchParams(
      next === 'all' ? { view: 'discussion', tab: 'all' } : { view: 'discussion' },
      { replace: true },
    )
  }

  async function sendResponse(payload: {
    decision: string
    follow_up_status?: string
    body_text?: string
  }) {
    if (!respondId) return
    try {
      const respond = reviewer === 'chef' ? api.chefRespond : api.waliRespond
      await respond(token, respondId, payload)
      setRespondId(null)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
      throw new Error('respond failed')
    }
  }

  function serviceLabel(r: any) {
    const svc = r.service
    if (!svc) return '—'
    return i18n.language === 'fr' ? svc.name_fr || svc.name_ar : svc.name_ar || svc.name_fr
  }

  function typeLabel(r: any) {
    const rt = r.rapportType
    if (!rt) return '—'
    return localizedRapportTypeName(rt, i18n.language)
  }

  function formatLastComment(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{discussionView ? t('navDiscussion') : t('navInbox')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton to={hubPath} fallbackTo={hubPath} />
      </div>

      <section className="inboxFilterBar card" aria-label={t('inboxViewTabs')}>
        <div className="inboxFilterBarTop">
          <div className="inboxViewTabs inboxViewTabs--primary" role="tablist" aria-label={t('inboxViewTabs')}>
            <button
              type="button"
              role="tab"
              aria-selected={!discussionView}
              className={`inboxViewTab${!discussionView ? ' active' : ''}`}
              onClick={() => setView('inbox')}
            >
              {t('navInbox')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={discussionView}
              className={`inboxViewTab${discussionView ? ' active' : ''}`}
              onClick={() => setView('discussion')}
            >
              <span>{t('navDiscussion')}</span>
              {unreadDiscussion > 0 ? (
                <span className="inboxTabCount" aria-label={t('unreadDiscussionBellWithCount', { count: unreadDiscussion })}>
                  {unreadLabel}
                </span>
              ) : null}
            </button>
          </div>

          {discussionView ? (
            <div
              className="inboxViewTabs inboxViewTabs--segment"
              role="tablist"
              aria-label={t('discussionSubTabs')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={!discussionAll}
                className={`inboxViewTab${!discussionAll ? ' active' : ''}`}
                onClick={() => setDiscussionTab('new')}
              >
                <span>{t('discussionTabNew')}</span>
                {unreadDiscussion > 0 ? (
                  <span className="inboxTabCount inboxTabCount--soft">{unreadLabel}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={discussionAll}
                className={`inboxViewTab${discussionAll ? ' active' : ''}`}
                onClick={() => setDiscussionTab('all')}
              >
                {t('discussionTabAll')}
              </button>
            </div>
          ) : null}
        </div>

        <p className="inboxViewHint">
          {discussionView
            ? discussionAll
              ? t('discussionAllHint')
              : t('discussionInboxHint')
            : t('actionInboxHint')}
        </p>

        <form className="inboxFilterSearch" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="inbox-rapport-search">
            {t('search')}
          </label>
          <input
            id="inbox-rapport-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchRapportPlaceholder')}
          />
          <button type="submit" className="btn btn-secondary">
            {t('search')}
          </button>
        </form>
      </section>

      {loading ? <PageLoading /> : null}

      <div className={`card tableWrap${discussionView ? ' discussionInboxTable' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('service')}</th>
              <th>{t('rapportTypes')}</th>
              {discussionView ? <th>{t('lastCommentAt')}</th> : <th>{t('rapportStatus')}</th>}
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const chefLabel = reviewer === 'chef' ? chefResponseLabel(r, t) : null
              const chefDecision = reviewer === 'chef' ? r.latest_chef_response?.decision : null
              const waliLabel = waliResponseLabel(r, t)
              const decision = r.latest_wali_response?.decision
              const showUnreadBadge =
                discussionView && (discussionAll ? !!r.has_unread_discussion : true)
              const rowClass = [
                waliInboxRowClass(r),
                discussionView && showUnreadBadge ? 'discussionRow--unread' : '',
                discussionView && !showUnreadBadge ? 'discussionRow--read' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr key={r.id} className={rowClass}>
                  <td className="rapportTitleCell">
                    <div className="rapportRowTitleCell">
                      <span className="rapportRowTitle">{r.title}</span>
                      {r.is_inbox_new ? (
                        <span className="badge badge-submitted rapportUnreadBadge">{t('waliInboxNew')}</span>
                      ) : null}
                      {showUnreadBadge ? (
                        <span className="badge badge-submitted rapportUnreadBadge">{t('unreadDiscussionBadge')}</span>
                      ) : null}
                    </div>
                    {discussionView && r.last_comment_at ? (
                      <p className="discussionRowMeta muted small">
                        {t('lastCommentAt')}: {formatLastComment(r.last_comment_at)}
                      </p>
                    ) : null}
                  </td>
                  <td>{serviceLabel(r)}</td>
                  <td>{typeLabel(r)}</td>
                  {discussionView ? (
                    <td className="discussionLastCommentCell">
                      <time dateTime={r.last_comment_at || undefined}>
                        {formatLastComment(r.last_comment_at)}
                      </time>
                    </td>
                  ) : (
                    <td className="rapportStatusCell">
                      <div className="rapportStatusStack">
                        <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
                        {chefLabel && chefDecision ? (
                          <p className="rapportWaliStatusNote muted small">
                            {t('chefResponseShort')}:{' '}
                            <span className={`badge badge-wali-${chefDecision} rapportWaliDecisionBadge`}>
                              {chefLabel}
                            </span>
                          </p>
                        ) : null}
                        {waliLabel && decision ? (
                          <p className="rapportWaliStatusNote muted small">
                            {t('waliResponseShort')}:{' '}
                            <span className={`badge badge-wali-${decision} rapportWaliDecisionBadge`}>
                              {waliLabel}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </td>
                  )}
                  <td className="actionsCell">
                    <div className="actionsCellInner">
                      <Link
                        className={`btn btn-sm ${discussionView ? 'btn-primary' : 'btn-secondary'}`}
                        to={`${base}/rapports/${r.id}/view`}
                        state={backNavigationState(inboxPath)}
                      >
                        {discussionView ? t('openDiscussion') : t('details')}
                      </Link>
                      {!discussionView &&
                      (reviewer === 'chef'
                        ? r.status === 'pending_chef'
                        : waliCanRespondFromList(r.status)) ? (
                        <button
                          type="button"
                          className="btn btn-accent btn-sm"
                          onClick={() => setRespondId(r.id)}
                        >
                          {t('respondRapport')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={5} className="discussionInboxEmptyCell">
                  {discussionView
                    ? discussionAll
                      ? t('discussionAllEmpty')
                      : t('discussionInboxEmpty')
                    : t('noResults')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      {!discussionView ? <RapportStatusFlowHelp variant="wali" /> : null}

      <WaliRespondModal
        open={!!respondId}
        onClose={() => setRespondId(null)}
        onSubmit={sendResponse}
        mode={reviewer === 'chef' ? 'chef' : 'wali'}
      />
    </div>
  )
}

export function AdminRapportsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, showHidden])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminRapports(token, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        search: search || undefined,
        hidden_only: showHidden,
      })
      setRows(res.rapports)
      setTotal(res.total ?? res.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, page, search, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  async function confirmDeleteRapport() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAdminRapport(token, deleteTarget.id)
      snack.show(t('deleteRapportAdminDone'), 'success')
      setDeleteTarget(null)
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navRapports')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <form className="rapportListToolbar rapportListSearchForm card" onSubmit={submitSearch}>
        <label className="rapportListSearch">
          <span className="fieldLabel">{t('search')}</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('rapportTitle')}
          />
        </label>
        <button type="submit" className="btn btn-secondary rapportListSearchBtn">
          {t('search')}
        </button>
      </form>

      {loading ? <PageLoading /> : null}

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('navServices')}</th>
              <th>{t('rapportTypes')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.service ? localizedName(r.service, i18n.language) : '—'}</td>
                <td>
                  {r.rapportType
                    ? localizedRapportTypeName(r.rapportType, i18n.language)
                    : '—'}
                </td>
                <td>{rapportStatusLabel(r.status, t)}</td>
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    <Link className="btn btn-secondary btn-sm" to={`/admin/rapports/${r.id}/view`}>
                      {t('details')}
                    </Link>
                    <RapportExportButtons token={token} rapportId={r.id} size="sm" />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(r)}
                    >
                      {t('deleteRapportAdmin')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t('noResults')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      <ConfirmActionModal
        open={!!deleteTarget}
        title={t('deleteRapportAdminConfirmTitle')}
        message={t('deleteRapportAdminConfirmMessage', { name: deleteTarget?.title || '' })}
        confirmLabel={t('deleteRapportAdmin')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteRapport}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
