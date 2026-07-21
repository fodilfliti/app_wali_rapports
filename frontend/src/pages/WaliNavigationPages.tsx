import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { HubTile } from '../components/HubTile'
import { HubCountBadge } from '../components/HubCountBadge'
import { TablePagination } from '../components/TablePagination'
import { ServiceRapportTypesHub } from '../components/ServiceRapportTypesHub'
import { ServiceContentKindsHub } from '../components/ServiceContentKindsHub'
import { serviceHubIcon } from '../components/HubIcons'
import {
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  rapportTypesForContentKind,
  reviewerRapportTypeListPath,
  type RapportTypeNav,
} from '../utils/rapportNavigation'
import { rapportStatusLabel } from '../utils/officeRapportList'
import { waliInboxRowClass } from '../utils/waliInboxList'
import {
  chefCanRespondFromList,
  type ReviewerMode,
  reviewerHubPath,
  reviewerOfficeUsersPath,
  reviewerRapportViewPath,
  reviewerUserServicesPath,
} from '../utils/reviewerMode'
import { waliCanRespondFromList } from '../utils/waliInboxList'
import { ChefDeleteRequestBanner, ChefRapportDeleteControls } from '../components/RapportDeleteControls'
import { RapportStatusFlowHelp } from '../components/RapportStatusFlowHelp'
import { WaliRespondModal } from '../components/WaliRespondModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { backNavigationState, currentPath } from '../utils/navigationBack'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { findServiceNode, folderBackPath, serviceLabel } from '../utils/serviceTree'
import { QueryListShell } from '../components/QueryListShell'
import { ListRefreshIndicator } from '../components/ListRefreshIndicator'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import {
  useReviewerOfficeUsersQuery,
  useReviewerRapportsListQuery,
  useReviewerServiceHubQuery,
  useReviewerUserServicesQuery,
} from '../hooks/queries/useListQueries'
import { useLocation } from 'react-router-dom'

type Props = { token: string; reviewer?: ReviewerMode }

function canRespondFromList(reviewer: ReviewerMode, status?: string) {
  return reviewer === 'chef' ? chefCanRespondFromList(status) : waliCanRespondFromList(status)
}

function respondApi(reviewer: ReviewerMode) {
  return reviewer === 'chef' ? api.chefRespond : api.waliRespond
}

function findServiceInTree(nodes: any[], serviceId: number): any {
  for (const n of nodes) {
    if (Number(n.id) === serviceId) return n
    if (n.children?.length) {
      const hit = findServiceInTree(n.children, serviceId)
      if (hit) return hit
    }
  }
  return null
}

export function WaliOfficeUsersPage({ token, reviewer = 'wali' }: Props) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const hub = reviewerHubPath(reviewer)
  const usersQuery = useReviewerOfficeUsersQuery(token, reviewer)
  const users = usersQuery.data ?? []
  const isInitialLoading = usersQuery.isLoading && usersQuery.data === undefined
  const isRefreshing = usersQuery.isFetching && !usersQuery.isLoading

  const pagedUsers = paginateSlice(users, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navOfficeUsers')}</h1>
        <BackButton to={hub} fallbackTo={hub} />
      </div>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
        <div className="hubGrid">
          {pagedUsers.map((u) => (
            <HubTile
              key={u.id}
              to={`${reviewerUserServicesPath(reviewer, u.id)}`}
              icon="users"
              title={u.name || u.username}
              subtitle={u.job_title || undefined}
              badge={
                Number(u.pending_rapports_count) > 0 ? (
                  <HubCountBadge count={Number(u.pending_rapports_count)} />
                ) : undefined
              }
            />
          ))}
          {!users.length && !isInitialLoading ? <p className="muted">{t('noResults')}</p> : null}
        </div>
        <TablePagination page={page} total={users.length} onPageChange={setPage} />
      </QueryListShell>
    </div>
  )
}

export function WaliUserServicesPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { folderId } = useParams()
  const fid = folderId ? Number(folderId) : undefined
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const basePath = reviewerUserServicesPath(reviewer, userId)
  const servicesQuery = useReviewerUserServicesQuery(token, userId, reviewer)
  const services = servicesQuery.data ?? []
  const isInitialLoading = servicesQuery.isLoading && servicesQuery.data === undefined
  const isRefreshing = servicesQuery.isFetching && !servicesQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [fid])

  const folder = fid ? findServiceNode(services, fid) : null
  const items = folder ? folder.children || [] : services
  const pagedItems = paginateSlice(items, page, DEFAULT_PAGE_SIZE)
  const pageTitle = folder ? serviceLabel(folder, i18n.language) : t('navServices')
  const backTo = fid ? folderBackPath(services, fid, basePath) : reviewerOfficeUsersPath(reviewer)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{pageTitle}</h1>
        <BackButton to={backTo} fallbackTo={backTo} />
      </div>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
        <div className="hubGrid hubGridServices">
          {pagedItems.map((s: any) => {
            const label = serviceLabel(s, i18n.language)
            const to = s.is_folder ? `${basePath}/folder/${s.id}` : `${basePath}/${s.id}`
            return (
              <HubTile
                key={s.id}
                to={to}
                icon={s.is_folder ? 'folder' : serviceHubIcon(s)}
                title={label}
                badge={
                  Number(s.action_count) > 0 ? (
                    <HubCountBadge count={Number(s.action_count)} />
                  ) : undefined
                }
              />
            )
          })}
        </div>
        {!items.length && !isInitialLoading ? <p className="muted">{t('noResults')}</p> : null}
        <TablePagination page={page} total={items.length} onPageChange={setPage} />
      </QueryListShell>
    </div>
  )
}

export function WaliServiceRapportTypesPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const hubQuery = useReviewerServiceHubQuery(token, userId, sid, reviewer)
  const hub = hubQuery.data
  const isInitialLoading = hubQuery.isLoading && !hub

  if (isInitialLoading || !hub?.service) {
    return (
      <div className="page">
        <QueryListShell isInitialLoading={isInitialLoading}>
          <span />
        </QueryListShell>
      </div>
    )
  }

  return (
    <ServiceContentKindsHub
      service={hub.service}
      summaries={hub.contentKindSummaries || []}
      contentKinds={hub.contentKinds}
      backTo={reviewerUserServicesPath(reviewer, userId)}
      rapportTypePath={(rt) => reviewerRapportTypeListPath(reviewer, userId, sid, rt.id)}
      mode="wali"
    />
  )
}

export function WaliServiceKindRapportTypesPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { serviceId, contentKind } = useParams()
  const sid = Number(serviceId)
  const kind = contentKind || ''
  const { t } = useTranslation()
  const hubQuery = useReviewerServiceHubQuery(token, userId, sid, reviewer)
  const hub = hubQuery.data
  const isInitialLoading = hubQuery.isLoading && !hub

  if (isInitialLoading || !hub?.service) {
    return (
      <div className="page">
        <QueryListShell isInitialLoading={isInitialLoading}>
          <span />
        </QueryListShell>
      </div>
    )
  }

  const types = rapportTypesForContentKind(hub, kind)

  return (
    <ServiceRapportTypesHub
      service={hub.service}
      rapportTypes={types}
      backTo={`${reviewerUserServicesPath(reviewer, userId)}/${sid}`}
      mode="wali"
      waliUserId={userId}
      pageTitle={t(`contentKind_${kind}`, { defaultValue: kind })}
    />
  )
}

export function WaliServiceRapportListPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { serviceId, rapportTypeId } = useParams()
  const sid = Number(serviceId)
  const typeId = Number(rapportTypeId)
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const listPath = currentPath(location)
  const [respondId, setRespondId] = useState<number | null>(null)
  const [deleteDecideId, setDeleteDecideId] = useState<number | null>(null)
  const [listPage, setListPage] = useState(1)

  const servicesQuery = useReviewerUserServicesQuery(token, userId, reviewer)
  const services = servicesQuery.data ?? []
  const service = sid ? findServiceInTree(services, sid) : null
  const rapportType =
    (service?.rapportTypes || []).find((x: RapportTypeNav) => Number(x.id) === typeId) || null

  const listQuery = useReviewerRapportsListQuery(token, reviewer, {
    service_id: sid,
    rapport_type_id: typeId,
    office_user_id: userId,
    page: listPage,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const rows = listQuery.data?.rapports ?? []
  const listTotal = Number(listQuery.data?.total ?? rows.length)
  const isInitialLoading =
    (servicesQuery.isLoading && servicesQuery.data === undefined) ||
    (listQuery.isLoading && !listQuery.data)
  const isRefreshing =
    (servicesQuery.isFetching && !servicesQuery.isLoading) ||
    (listQuery.isFetching && !listQuery.isLoading)

  useEffect(() => {
    setListPage(1)
  }, [sid, typeId])

  useEffect(() => {
    if (
      !rapportType ||
      !isDirectWorkspaceKind(rapportType.content_kind) ||
      listPage !== 1 ||
      listQuery.isLoading ||
      rows.length !== 1
    ) {
      return
    }
    const total = Number(listQuery.data?.total ?? rows.length)
    if (total !== 1 && Number.isFinite(Number(listQuery.data?.total))) return
    const backTo = `${reviewerUserServicesPath(reviewer, userId)}/${sid}`
    navigate(reviewerRapportViewPath(reviewer, rows[0].id), {
      replace: true,
      state: backNavigationState(backTo),
    })
  }, [
    rapportType,
    listPage,
    listQuery.isLoading,
    listQuery.data?.total,
    rows,
    navigate,
    reviewer,
    userId,
    sid,
  ])

  async function sendResponse(payload: {
    decision: string
    follow_up_status?: string
    body_text?: string
  }) {
    if (!respondId) return
    try {
      await respondApi(reviewer)(token, respondId, payload)
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

  const pageTitle = rapportType
    ? localizedRapportTypeName(rapportType, i18n.language)
    : service
      ? i18n.language === 'fr'
        ? service.name_fr
        : service.name_ar
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
        <h1>{pageTitle}</h1>
        <BackButton fallbackTo={`${reviewerUserServicesPath(reviewer, userId)}/${sid}`} />
      </div>
      <ListRefreshIndicator show={isRefreshing} />

      {reviewer === 'chef' &&
      rows.some((r) => r.delete_requested || r.delete_requested_at) ? (
        <ChefDeleteRequestBanner
          rapport={rows.find((r) => r.delete_requested || r.delete_requested_at)}
          deleting={deleteDecideId != null}
          onDecide={async (decision) => {
            const target = rows.find((r) => r.delete_requested || r.delete_requested_at)
            if (!target) return
            setDeleteDecideId(target.id)
            try {
              const result = await api.chefDeleteDecision(token, target.id, decision)
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
                snack.show(t('chefDeleteRestoredPreviousDone'), 'success')
                navigate(reviewerRapportViewPath('chef', target.id))
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
              <tr key={r.id} className={waliInboxRowClass(r)}>
                <td className="rapportTitleCell">
                  <div className="rapportRowTitleCell">
                    <span className="rapportRowTitle">{r.title}</span>
                    {r.is_inbox_new ? (
                      <span className="badge badge-submitted rapportUnreadBadge">{t('waliInboxNew')}</span>
                    ) : null}
                  </div>
                </td>
                <td className="rapportStatusCell">
                  <div className="rapportStatusStack">
                    <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
                    {reviewer === 'chef' &&
                    (r.delete_requested || r.delete_requested_at) ? (
                      <span className="badge badge-changes_requested">
                        {t('deleteRapportPendingBadge')}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    <Link
                      className="btn btn-secondary btn-sm"
                      to={reviewerRapportViewPath(reviewer, r.id)}
                      state={backNavigationState(listPath)}
                    >
                      {t('details')}
                    </Link>
                    {canRespondFromList(reviewer, r.status) ? (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        onClick={() => setRespondId(r.id)}
                      >
                        {t('respondRapport')}
                      </button>
                    ) : null}
                    {reviewer === 'chef' &&
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
                              navigate(reviewerRapportViewPath('chef', r.id))
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
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={listPage} total={listTotal} onPageChange={setListPage} />

      <RapportStatusFlowHelp variant="wali" />

      <WaliRespondModal
        open={!!respondId}
        onClose={() => setRespondId(null)}
        onSubmit={sendResponse}
        mode={reviewer === 'chef' ? 'chef' : 'wali'}
      />
    </div>
  )
}
