import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
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
  canOfficeStartNewVersion,
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
import {
  parseStatusGroupParam,
  statusGroupChips,
  type RapportStatusGroup,
} from '../utils/rapportStatusGroup'
import {
  LIST_SORT_CHIPS,
  parseListSortParam,
  type RapportListSort,
} from '../utils/rapportListSort'
import { RapportStatusFlowHelp } from '../components/RapportStatusFlowHelp'
import { waliInboxRowClass, waliCanRespondFromList } from '../utils/waliInboxList'
import { backNavigationState } from '../utils/navigationBack'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import {
  useAdminRapportsListQuery,
  useOfficeRapportsListQuery,
  useOfficeServiceHubQuery,
  useReviewerRapportsListQuery,
} from '../hooks/queries/useListQueries'
import { queryKeys } from '../query/queryKeys'
import { useChefHubCounts, useOfficeHubCounts, useWaliHubCounts } from '../hooks/useHubCounts'
import { localizedName } from '../utils/schemaColumns'
import { RapportExportButtons } from '../components/ExportPdfButton'
import { BusyButton } from '../components/BusyButton'
import { ReturnRapportToDraftConfirm } from '../components/ReturnRapportToDraftConfirm'
import { StartNewVersionConfirm } from '../components/StartNewVersionConfirm'
import {
  ChefRapportDeleteControls,
  OfficeRapportDeleteControls,
} from '../components/RapportDeleteControls'
import { PageLoading } from '../components/PageLoading'
import { QueryListShell } from '../components/QueryListShell'
import { ListRefreshIndicator } from '../components/ListRefreshIndicator'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'

type Props = { token: string }

function isDocumentKind(r: any) {
  return ['document_compose', 'fiche_lecture'].includes(r.rapportType?.content_kind)
}

function openOfficeRapport(
  token: string,
  rapportId: number,
  queryClient: ReturnType<typeof useQueryClient>,
  listKey: ReturnType<typeof queryKeys.rapports>,
) {
  queryClient.setQueryData(listKey, (old: { rapports?: any[]; total?: number } | undefined) => {
    if (!old?.rapports) return old
    return { ...old, rapports: patchRapportUnread(old.rapports, rapportId) }
  })
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
        {r.delete_requested || r.delete_requested_at ? (
          <span className="badge badge-changes_requested">{t('deleteRapportPendingBadge')}</span>
        ) : null}
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

function StatusGroupFilterBar({
  role,
  value,
  onChange,
  t,
  chipCounts,
}: {
  role: 'office' | 'admin' | 'wali' | 'chef'
  value: RapportStatusGroup
  onChange: (next: RapportStatusGroup) => void
  t: (k: string, opts?: Record<string, unknown>) => string
  chipCounts?: Partial<Record<RapportStatusGroup, number>>
}) {
  const chips = statusGroupChips(role)
  return (
    <div
      className="inboxViewTabs inboxViewTabs--segment"
      role="tablist"
      aria-label={t('statusGroupFilter')}
    >
      {chips.map((chip) => {
        const count = chipCounts?.[chip.id] ?? 0
        const countLabel = count > 99 ? '99+' : String(count)
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={value === chip.id}
            className={`inboxViewTab${value === chip.id ? ' active' : ''}`}
            onClick={() => onChange(chip.id)}
          >
            <span>{t(chip.labelKey)}</span>
            {count > 0 ? (
              <span className="inboxTabCount" aria-hidden="true">
                {countLabel}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function ListSortFilterBar({
  value,
  onChange,
  t,
}: {
  value: RapportListSort
  onChange: (next: RapportListSort) => void
  t: (k: string) => string
}) {
  return (
    <div
      className="inboxViewTabs inboxViewTabs--segment"
      role="tablist"
      aria-label={t('listSortFilter')}
    >
      {LIST_SORT_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          role="tab"
          aria-selected={value === chip.id}
          className={`inboxViewTab${value === chip.id ? ' active' : ''}`}
          onClick={() => onChange(chip.id)}
        >
          {t(chip.labelKey)}
        </button>
      ))}
    </div>
  )
}

/** Office: active vs finished (soft-hidden) — same segment style as sort. */
function ListScopeFilterBar({
  finished,
  onChange,
  t,
}: {
  finished: boolean
  onChange: (finished: boolean) => void
  t: (k: string) => string
}) {
  return (
    <div
      className="inboxViewTabs inboxViewTabs--segment inboxViewTabs--scope"
      role="tablist"
      aria-label={t('showFinishedRapports')}
    >
      <button
        type="button"
        role="tab"
        aria-selected={!finished}
        className={`inboxViewTab${!finished ? ' active' : ''}`}
        onClick={() => onChange(false)}
      >
        {t('rapportListActive')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={finished}
        className={`inboxViewTab${finished ? ' active' : ''}`}
        onClick={() => onChange(true)}
      >
        {t('navFinishedRapports')}
      </button>
    </div>
  )
}

function RapportListFilterToolbar({
  role,
  statusGroup,
  onStatusGroup,
  listSort,
  onListSort,
  finished,
  onFinishedChange,
  t,
  chipCounts,
}: {
  role: 'office' | 'admin' | 'wali' | 'chef'
  statusGroup: RapportStatusGroup
  onStatusGroup: (next: RapportStatusGroup) => void
  listSort: RapportListSort
  onListSort: (next: RapportListSort) => void
  finished?: boolean
  onFinishedChange?: (finished: boolean) => void
  t: (k: string, opts?: Record<string, unknown>) => string
  chipCounts?: Partial<Record<RapportStatusGroup, number>>
}) {
  return (
    <div className="inboxListFiltersRow">
      <StatusGroupFilterBar
        role={role}
        value={statusGroup}
        onChange={onStatusGroup}
        t={t}
        chipCounts={chipCounts}
      />
      <ListSortFilterBar value={listSort} onChange={onListSort} t={t} />
      {onFinishedChange != null ? (
        <ListScopeFilterBar finished={!!finished} onChange={onFinishedChange} t={t} />
      ) : null}
    </div>
  )
}

/** Build list URL params preserving status_group + sort (+ optional service_id / finished). */
function buildRapportListParams(opts: {
  serviceId?: number
  statusGroup?: RapportStatusGroup
  sort?: RapportListSort
  finished?: boolean
}): Record<string, string> {
  const next: Record<string, string> = {}
  if (opts.finished) next.hidden = '1'
  if (opts.serviceId) next.service_id = String(opts.serviceId)
  if (opts.statusGroup && opts.statusGroup !== 'all') next.status_group = opts.statusGroup
  if (opts.sort === 'updated_at') next.sort = 'updated_at'
  return next
}

export function OfficeRapportsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateAppQueries()
  const [searchParams, setSearchParams] = useSearchParams()
  const serviceId = searchParams.get('service_id') ? Number(searchParams.get('service_id')) : undefined
  const discussionView = searchParams.get('view') === 'discussion'
  const finishedView =
    searchParams.get('hidden') === '1' || searchParams.get('view') === 'finished'
  const discussionTab = searchParams.get('tab') === 'all' ? 'all' : 'new'
  const discussionAll = discussionView && discussionTab === 'all'
  const showHidden = finishedView && !discussionView
  const statusGroup = parseStatusGroupParam(searchParams.get('status_group'))
  const listSort = parseListSortParam(searchParams.get('sort'))
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [returningId, setReturningId] = useState<number | null>(null)
  const [startingNewVersionId, setStartingNewVersionId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [cancellingDeleteId, setCancellingDeleteId] = useState<number | null>(null)
  const [importFor, setImportFor] = useState<{ rapportId: number; serviceId: number; typeId: number } | null>(
    null,
  )
  const { counts } = useOfficeHubCounts(token)
  const unreadDiscussion = counts.unread_discussion || 0
  const unreadLabel = unreadDiscussion > 99 ? '99+' : String(unreadDiscussion)

  const listParams = {
    service_id: discussionView ? undefined : serviceId,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    status_group: discussionView ? undefined : statusGroup,
    sort: discussionView ? undefined : listSort,
    hidden_only: discussionView ? false : showHidden,
    unread_discussion: discussionView && !discussionAll ? true : undefined,
    has_discussion: discussionAll ? true : undefined,
  }
  const listKey = queryKeys.rapports('office', listParams as Record<string, unknown>)
  const listQuery = useOfficeRapportsListQuery(token, listParams)
  const rows = listQuery.data?.rapports ?? []
  const total = listQuery.data?.total ?? rows.length
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [serviceId, showHidden, search, discussionView, discussionTab, statusGroup, listSort])

  useEffect(() => {
    if (listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [listQuery.isError, snack, t])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function setView(next: 'list' | 'discussion') {
    if (next === 'discussion') {
      setSearchParams({ view: 'discussion' }, { replace: true })
      return
    }
    setSearchParams(
      buildRapportListParams({
        serviceId,
        statusGroup,
        sort: listSort,
        finished: finishedView,
      }),
      { replace: true },
    )
  }

  function setStatusGroup(next: RapportStatusGroup) {
    setSearchParams(
      buildRapportListParams({
        serviceId,
        statusGroup: next,
        sort: listSort,
        finished: showHidden,
      }),
      { replace: true },
    )
  }

  function setListSort(next: RapportListSort) {
    setSearchParams(
      buildRapportListParams({
        serviceId,
        statusGroup,
        sort: next,
        finished: showHidden,
      }),
      { replace: true },
    )
  }

  function setFinishedScope(next: boolean) {
    setSearchParams(
      buildRapportListParams({
        serviceId,
        statusGroup,
        sort: listSort,
        finished: next,
      }),
      { replace: true },
    )
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
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      snack.show(t('finishRapportDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapport(id: number) {
    try {
      await api.restoreRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      snack.show(t('restoreRapportDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    setSubmittingId(id)
    try {
      await api.submitRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
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
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      snack.show(t('returnToDraftDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setReturningId(null)
    }
  }

  async function startNewVersion(id: number, r: any) {
    setStartingNewVersionId(id)
    try {
      await api.startOfficeNewVersion(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      snack.show(t('startNewVersionDone'), 'success')
      const path = officeRapportWorkspacePath(r)
      if (path) navigate(path)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setStartingNewVersionId(null)
    }
  }

  async function deleteRapport(id: number) {
    setDeletingId(id)
    try {
      const result = await api.officeDeleteRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      if (result.mode === 'requested') {
        snack.show(t('deleteRapportRequestSent'), 'success')
      } else if (result.mode === 'discard_draft_version') {
        snack.show(t('deleteRapportDiscardVersionDone'), 'success')
      } else if (result.mode === 'reset_fresh_v1') {
        snack.show(t('deleteRapportResetV1Done'), 'success')
      } else {
        snack.show(t('deleteRapportDone'), 'success')
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function cancelDeleteRequest(id: number) {
    setCancellingDeleteId(id)
    try {
      await api.cancelRapportDeleteRequest(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office' },
      })
      snack.show(t('cancelDeleteRequestDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setCancellingDeleteId(null)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{discussionView ? t('navDiscussion') : t('navRapports')}</h1>
        <button type="button" className="btn btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
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
            : showHidden
              ? t('officeFinishedRapportsHint')
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

        {!discussionView ? (
          <RapportListFilterToolbar
            role="office"
            statusGroup={statusGroup}
            onStatusGroup={setStatusGroup}
            listSort={listSort}
            onListSort={setListSort}
            finished={showHidden}
            onFinishedChange={setFinishedScope}
            t={t}
          />
        ) : null}
      </section>

      {isInitialLoading ? <PageLoading /> : null}
      {!isInitialLoading ? <ListRefreshIndicator show={isRefreshing} /> : null}

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
              await invalidate({ rapports: true })
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
                          onClick={() => openOfficeRapport(token, r.id, queryClient, listKey)}
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
                      {!discussionView &&
                      canOfficeStartNewVersion(
                        r.status,
                        r.rapportType?.versioning_mode,
                      ) ? (
                        <StartNewVersionConfirm onConfirm={() => startNewVersion(r.id, r)}>
                          {(openConfirm) => (
                            <BusyButton
                              type="button"
                              className="btn btn-primary btn-sm"
                              busy={startingNewVersionId === r.id}
                              busyLabel={t('loading')}
                              onClick={openConfirm}
                            >
                              {t('startNewVersion')}
                            </BusyButton>
                          )}
                        </StartNewVersionConfirm>
                      ) : null}
                      {!discussionView ? (
                        <OfficeRapportDeleteControls
                          rapport={r}
                          canManage
                          deleting={deletingId === r.id}
                          cancelling={cancellingDeleteId === r.id}
                          onDelete={() => deleteRapport(r.id)}
                          onCancelRequest={() => cancelDeleteRequest(r.id)}
                        />
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
            {!isInitialLoading && !rows.length ? (
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
  const queryClient = useQueryClient()
  const invalidate = useInvalidateAppQueries()
  const [page, setPage] = useState(1)
  const [createPickOpen, setCreatePickOpen] = useState(false)
  const [importFor, setImportFor] = useState<{ rapportId: number; typeId: number } | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [returningId, setReturningId] = useState<number | null>(null)
  const [startingNewVersionId, setStartingNewVersionId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [cancellingDeleteId, setCancellingDeleteId] = useState<number | null>(null)

  const hubQuery = useOfficeServiceHubQuery(token, sid)
  const hub = hubQuery.data
  const rapportType =
    hub?.rapportTypes?.find((x: RapportTypeNav) => Number(x.id) === typeId) || null

  const listParams = {
    service_id: sid,
    rapport_type_id: typeId,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    hidden_only: showHidden,
  }
  const listKey = queryKeys.rapports('office', listParams as Record<string, unknown>)
  const listQuery = useOfficeRapportsListQuery(token, listParams)
  const rows = listQuery.data?.rapports ?? []
  const total = listQuery.data?.total ?? rows.length
  const isInitialLoading =
    (hubQuery.isLoading && !hub) || (listQuery.isLoading && !listQuery.data)
  const isRefreshing =
    (hubQuery.isFetching && !hubQuery.isLoading) || (listQuery.isFetching && !listQuery.isLoading)

  useEffect(() => {
    setPage(1)
  }, [sid, typeId, showHidden])

  useEffect(() => {
    if (hubQuery.isError || listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [hubQuery.isError, listQuery.isError, snack, t])

  async function finishRapportRow(id: number) {
    try {
      await api.finishRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('finishRapportDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapportRow(id: number) {
    try {
      await api.restoreRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('restoreRapportDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function hideTypeFromPage(hideTypeId: number) {
    try {
      await api.hideRapportType(token, hideTypeId)
      await invalidate({ hubCounts: 'office', serviceTrees: true, serviceHub: { scope: 'office', serviceId: sid } })
      snack.show(t('hideRapportTypeDone'), 'success')
      navigate(`/office/services/${sid}`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreTypeFromPage(restoreTypeId: number) {
    try {
      await api.restoreRapportType(token, restoreTypeId)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('restoreRapportTypeDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    setSubmittingId(id)
    try {
      await api.submitRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
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
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('returnToDraftDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setReturningId(null)
    }
  }

  async function startNewVersion(id: number, r: any) {
    setStartingNewVersionId(id)
    try {
      await api.startOfficeNewVersion(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('startNewVersionDone'), 'success')
      const path =
        officeRapportWorkspacePath(r) ||
        (rapportType
          ? officeRapportTypeWorkspacePath(sid, rapportType, r.id)
          : null)
      if (path) navigate(path)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setStartingNewVersionId(null)
    }
  }

  async function deleteRapport(id: number) {
    setDeletingId(id)
    try {
      const result = await api.officeDeleteRapport(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      if (result.mode === 'requested') {
        snack.show(t('deleteRapportRequestSent'), 'success')
      } else if (result.mode === 'discard_draft_version') {
        snack.show(t('deleteRapportDiscardVersionDone'), 'success')
      } else if (result.mode === 'reset_fresh_v1') {
        snack.show(t('deleteRapportResetV1Done'), 'success')
      } else {
        snack.show(t('deleteRapportDone'), 'success')
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function cancelDeleteRequest(id: number) {
    setCancellingDeleteId(id)
    try {
      await api.cancelRapportDeleteRequest(token, id)
      await invalidate({
        rapports: true,
        hubCounts: 'office',
        serviceTrees: true,
        serviceHub: { scope: 'office', serviceId: sid },
      })
      snack.show(t('cancelDeleteRequestDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setCancellingDeleteId(null)
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

  if (isInitialLoading) {
    return (
      <div className="page">
        <QueryListShell isInitialLoading>
          <span />
        </QueryListShell>
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
        <BackButton to={`/office/services/${sid}`} fallbackTo={`/office/services/${sid}`} />
      </div>

      {canEdit && rapportType ? (
        <p className="muted small">{t('createRapportUnderTypeHint')}</p>
      ) : null}

      <ListRefreshIndicator show={isRefreshing} />

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
              await invalidate({ rapports: true })
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
                      onClick={() => openOfficeRapport(token, r.id, queryClient, listKey)}
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
                  {canEdit &&
                  canOfficeStartNewVersion(
                    r.status,
                    r.rapportType?.versioning_mode || rapportType?.versioning_mode,
                  ) ? (
                    <StartNewVersionConfirm onConfirm={() => startNewVersion(r.id, r)}>
                      {(openConfirm) => (
                        <BusyButton
                          type="button"
                          className="btn btn-primary btn-sm"
                          busy={startingNewVersionId === r.id}
                          busyLabel={t('loading')}
                          onClick={openConfirm}
                        >
                          {t('startNewVersion')}
                        </BusyButton>
                      )}
                    </StartNewVersionConfirm>
                  ) : null}
                  <OfficeRapportDeleteControls
                    rapport={r}
                    canManage={canEdit}
                    deleting={deletingId === r.id}
                    cancelling={cancellingDeleteId === r.id}
                    onDelete={() => deleteRapport(r.id)}
                    onCancelRequest={() => cancelDeleteRequest(r.id)}
                  />
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
            {!isInitialLoading && !rows.length ? (
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
  const navigate = useNavigate()
  const invalidate = useInvalidateAppQueries()
  const [searchParams, setSearchParams] = useSearchParams()
  const discussionView = searchParams.get('view') === 'discussion'
  const discussionTab = searchParams.get('tab') === 'all' ? 'all' : 'new'
  const discussionAll = discussionView && discussionTab === 'all'
  const statusGroup = parseStatusGroupParam(searchParams.get('status_group'))
  const listSort = parseListSortParam(searchParams.get('sort'))
  const base = reviewer === 'chef' ? '/chef' : '/wali'
  const listQs = new URLSearchParams(
    buildRapportListParams({ statusGroup, sort: listSort }),
  ).toString()
  const inboxPath = discussionView
    ? discussionAll
      ? `${base}/rapports?view=discussion&tab=all`
      : `${base}/rapports?view=discussion`
    : listQs
      ? `${base}/rapports?${listQs}`
      : `${base}/rapports`
  const hubPath = base
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [respondId, setRespondId] = useState<number | null>(null)
  const [deleteDecideId, setDeleteDecideId] = useState<number | null>(null)
  const waliCounts = useWaliHubCounts(reviewer === 'wali' ? token : '')
  const chefCounts = useChefHubCounts(reviewer === 'chef' ? token : '')
  const unreadDiscussion =
    reviewer === 'chef'
      ? chefCounts.counts.unread_discussion || 0
      : waliCounts.counts.unread_discussion || 0
  const deletePending =
    reviewer === 'chef' ? chefCounts.counts.delete_pending || 0 : 0
  const unreadLabel = unreadDiscussion > 99 ? '99+' : String(unreadDiscussion)

  const listParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    status_group: discussionView ? undefined : statusGroup,
    sort: discussionView ? undefined : listSort,
    unread_discussion: discussionView && !discussionAll ? true : undefined,
    has_discussion: discussionAll ? true : undefined,
  }
  const listQuery = useReviewerRapportsListQuery(token, reviewer, listParams)
  const rows = listQuery.data?.rapports ?? []
  const total = listQuery.data?.total ?? rows.length
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [search, discussionView, discussionTab, statusGroup, listSort])

  useEffect(() => {
    if (listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [listQuery.isError, snack, t])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function setView(next: 'inbox' | 'discussion') {
    if (next === 'discussion') {
      setSearchParams({ view: 'discussion' }, { replace: true })
      return
    }
    setSearchParams(buildRapportListParams({ statusGroup, sort: listSort }), { replace: true })
  }

  function setStatusGroup(next: RapportStatusGroup) {
    setSearchParams(buildRapportListParams({ statusGroup: next, sort: listSort }), {
      replace: true,
    })
  }

  function setListSort(next: RapportListSort) {
    setSearchParams(buildRapportListParams({ statusGroup, sort: next }), { replace: true })
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
      await invalidate({
        rapports: true,
        hubCounts: reviewer === 'chef' ? 'chef' : 'wali',
        officeUsers: reviewer,
        serviceTrees: true,
        serviceHub: { scope: reviewer === 'chef' ? 'chef' : 'wali' },
      })
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
        <button type="button" className="btn btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
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

        {!discussionView ? (
          <RapportListFilterToolbar
            role={reviewer === 'chef' ? 'chef' : 'wali'}
            statusGroup={statusGroup}
            onStatusGroup={setStatusGroup}
            listSort={listSort}
            onListSort={setListSort}
            t={t}
            chipCounts={
              reviewer === 'chef'
                ? { delete_requested: deletePending }
                : undefined
            }
          />
        ) : null}
      </section>

      {isInitialLoading ? <PageLoading /> : null}
      {!isInitialLoading ? <ListRefreshIndicator show={isRefreshing} /> : null}

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
                        {reviewer === 'chef' &&
                        (r.delete_requested || r.delete_requested_at) ? (
                          <span className="badge badge-changes_requested">
                            {t('deleteRapportPendingBadge')}
                          </span>
                        ) : null}
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
                      {!discussionView &&
                      reviewer === 'chef' &&
                      (r.delete_requested || r.delete_requested_at) ? (
                        <ChefRapportDeleteControls
                          rapport={r}
                          deleting={deleteDecideId === r.id}
                          onDecide={async (decision) => {
                            setDeleteDecideId(r.id)
                            try {
                              const result = await api.chefDeleteDecision(
                                token,
                                r.id,
                                decision,
                              )
                              await invalidate({
                                rapports: true,
                                hubCounts: 'chef',
                                officeUsers: 'chef',
                                serviceTrees: true,
                                serviceHub: { scope: 'chef' },
                              })
                              if (decision === 'rejected') {
                                snack.show(t('chefRejectDeleteDone'), 'success')
                              } else if (result.mode === 'restored_previous') {
                                snack.show(
                                  t('chefDeleteRestoredPreviousDone'),
                                  'success',
                                )
                                navigate(`/chef/rapports/${r.id}/view`)
                              } else {
                                snack.show(t('chefDeleteFullyDone'), 'success')
                              }
                            } catch {
                              snack.show(t('errorGeneric'), 'error')
                            } finally {
                              setDeleteDecideId(null)
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isInitialLoading && !rows.length ? (
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
  const invalidate = useInvalidateAppQueries()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusGroup = parseStatusGroupParam(searchParams.get('status_group'))
  const listSort = parseListSortParam(searchParams.get('sort'))
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showHidden] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const listParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    status_group: statusGroup,
    sort: listSort,
    hidden_only: showHidden,
  }
  const listQuery = useAdminRapportsListQuery(token, listParams)
  const rows = listQuery.data?.rapports ?? []
  const total = listQuery.data?.total ?? rows.length
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [search, showHidden, statusGroup, listSort])

  useEffect(() => {
    if (listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [listQuery.isError, snack, t])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function setStatusGroup(next: RapportStatusGroup) {
    setSearchParams(buildRapportListParams({ statusGroup: next, sort: listSort }), {
      replace: true,
    })
  }

  function setListSort(next: RapportListSort) {
    setSearchParams(buildRapportListParams({ statusGroup, sort: next }), { replace: true })
  }

  async function confirmDeleteRapport() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAdminRapport(token, deleteTarget.id)
      snack.show(t('deleteRapportAdminDone'), 'success')
      setDeleteTarget(null)
      await invalidate({ rapports: true })
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
        <button type="button" className="btn btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
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
        <RapportListFilterToolbar
          role="admin"
          statusGroup={statusGroup}
          onStatusGroup={setStatusGroup}
          listSort={listSort}
          onListSort={setListSort}
          t={t}
        />
      </form>

      {isInitialLoading ? <PageLoading /> : null}
      {!isInitialLoading ? <ListRefreshIndicator show={isRefreshing} /> : null}

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
            {!isInitialLoading && !rows.length ? (
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
