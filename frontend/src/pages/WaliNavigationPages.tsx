import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
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
import { chefCanRespondFromList, type ReviewerMode, reviewerHubPath, reviewerOfficeUsersPath, reviewerRapportViewPath, reviewerUserServicesPath } from '../utils/reviewerMode'
import { waliCanRespondFromList } from '../utils/waliInboxList'
import { RapportStatusFlowHelp } from '../components/RapportStatusFlowHelp'
import { WaliRespondModal } from '../components/WaliRespondModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { notifyHubCountsRefresh, HUB_COUNTS_REFRESH_EVENT } from '../utils/hubCountsRefresh'
import { backNavigationState, currentPath } from '../utils/navigationBack'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { findServiceNode, folderBackPath, serviceLabel } from '../utils/serviceTree'
import { PageLoading } from '../components/PageLoading'

type Props = { token: string; reviewer?: ReviewerMode }

function canRespondFromList(reviewer: ReviewerMode, status?: string) {
  return reviewer === 'chef' ? chefCanRespondFromList(status) : waliCanRespondFromList(status)
}

function respondApi(reviewer: ReviewerMode) {
  return reviewer === 'chef' ? api.chefRespond : api.waliRespond
}

export function WaliOfficeUsersPage({ token, reviewer = 'wali' }: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const hub = reviewerHubPath(reviewer)
  const listUsers = reviewer === 'chef' ? api.listChefOfficeUsers : api.listWaliOfficeUsers

  useEffect(() => {
    listUsers(token).then((r) => setUsers(r.officeUsers)).catch(() => {})
  }, [token, location.pathname, listUsers])

  useEffect(() => {
    const refresh = () => {
      listUsers(token).then((r) => setUsers(r.officeUsers)).catch(() => {})
    }
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
  }, [token, listUsers])

  const pagedUsers = paginateSlice(users, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navOfficeUsers')}</h1>
        <BackButton to={hub} fallbackTo={hub} />
      </div>
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
        {!users.length ? <p className="muted">{t('noResults')}</p> : null}
      </div>
      <TablePagination page={page} total={users.length} onPageChange={setPage} />
    </div>
  )
}

export function WaliUserServicesPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { folderId } = useParams()
  const location = useLocation()
  const fid = folderId ? Number(folderId) : undefined
  const { t, i18n } = useTranslation()
  const [services, setServices] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const basePath = reviewerUserServicesPath(reviewer, userId)
  const listServices = reviewer === 'chef' ? api.listChefUserServices : api.listWaliUserServices

  useEffect(() => {
    listServices(token, userId).then((r) => setServices(r.services)).catch(() => {})
  }, [token, userId, location.pathname, listServices])

  useEffect(() => {
    const refresh = () => {
      listServices(token, userId).then((r) => setServices(r.services)).catch(() => {})
    }
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
  }, [token, userId, listServices])

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
      {!items.length ? <p className="muted">{t('noResults')}</p> : null}
      <TablePagination page={page} total={items.length} onPageChange={setPage} />
    </div>
  )
}

export function WaliServiceRapportTypesPage({ token, userId, reviewer = 'wali' }: Props & { userId: number }) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const [hub, setHub] = useState<any>(null)
  const loadHub = useCallback(() => {
    if (!sid) return
    const load =
      reviewer === 'chef'
        ? api.getChefServiceContentHub(token, userId, sid)
        : api.getWaliServiceContentHub(token, userId, sid)
    load.then(setHub).catch(() => {})
  }, [token, userId, sid, reviewer])

  useEffect(() => {
    loadHub()
  }, [loadHub])

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
  }, [loadHub])

  if (!hub?.service) {
    return (
      <div className="page">
        <PageLoading />
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
  const [hub, setHub] = useState<any>(null)

  const loadHub = useCallback(() => {
    if (!sid) return
    const load =
      reviewer === 'chef'
        ? api.getChefServiceContentHub(token, userId, sid)
        : api.getWaliServiceContentHub(token, userId, sid)
    load.then(setHub).catch(() => {})
  }, [token, userId, sid, reviewer])

  useEffect(() => {
    loadHub()
  }, [loadHub])

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
  }, [loadHub])

  if (!hub?.service) {
    return (
      <div className="page">
        <PageLoading />
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
  const listPath = currentPath(location)
  const [respondId, setRespondId] = useState<number | null>(null)
  const [service, setService] = useState<any>(null)
  const [rapportType, setRapportType] = useState<RapportTypeNav | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [listPage, setListPage] = useState(1)
  const [listTotal, setListTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setListPage(1)
  }, [sid, typeId])

  const load = useCallback(async () => {
    if (!sid || !typeId) return
    setLoading(true)
    try {
      const svcRes =
        reviewer === 'chef'
          ? await api.listChefUserServices(token, userId)
          : await api.listWaliUserServices(token, userId)
      const find = (nodes: any[]): any => {
        for (const n of nodes) {
          if (Number(n.id) === sid) return n
          if (n.children?.length) {
            const hit = find(n.children)
            if (hit) return hit
          }
        }
        return null
      }
      const svc = find(svcRes.services)
      const rt = (svc?.rapportTypes || []).find((x: RapportTypeNav) => Number(x.id) === typeId) || null
      setService(svc)
      setRapportType(rt)

      const listRapports =
        reviewer === 'chef' ? api.listChefRapports : api.listWaliRapports
      const rapRes = await listRapports(token, {
        service_id: sid,
        rapport_type_id: typeId,
        office_user_id: userId,
        page: listPage,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setRows(rapRes.rapports)
      const total = Number(rapRes.total ?? rapRes.rapports.length)
      setListTotal(Number.isFinite(total) ? total : rapRes.rapports.length)

      // Table / liste types with a single rapport open the view directly (same as office workspace).
      if (
        rt &&
        isDirectWorkspaceKind(rt.content_kind) &&
        listPage === 1 &&
        rapRes.rapports.length === 1 &&
        (total === 1 || !Number.isFinite(Number(rapRes.total)))
      ) {
        const backTo = `${reviewerUserServicesPath(reviewer, userId)}/${sid}`
        navigate(reviewerRapportViewPath(reviewer, rapRes.rapports[0].id), {
          replace: true,
          state: backNavigationState(backTo),
        })
      }
    } finally {
      setLoading(false)
    }
  }, [token, userId, sid, typeId, listPage, navigate, reviewer, rapportType?.content_kind])

  useEffect(() => {
    load()
  }, [load])

  async function sendResponse(payload: {
    decision: string
    follow_up_status?: string
    body_text?: string
  }) {
    if (!respondId) return
    try {
      await respondApi(reviewer)(token, respondId, payload)
      setRespondId(null)
      notifyHubCountsRefresh()
      load()
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
        <h1>{pageTitle}</h1>
        <BackButton
          fallbackTo={`${reviewerUserServicesPath(reviewer, userId)}/${sid}`}
        />
      </div>

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
                  <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
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
