import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { TablePagination } from '../components/TablePagination'
import { waliResponseBodyText } from '../components/WaliRespondModal'
import { HubIcon } from '../components/HubIcons'
import { useOfficeHubCounts } from '../hooks/useHubCounts'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { waliDecisionLabel } from '../utils/waliDecision'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

type Props = { token: string }

function rapportLink(n: any) {
  const rapport = n.rapport
  if (!rapport) return '/office/rapports'
  const kind = rapport.rapportType?.content_kind
  const sid = rapport.service_id
  const typeId = rapport.rapport_type_id || rapport.rapportType?.id
  if (kind === 'table_grid') {
    const q = new URLSearchParams()
    if (typeId) q.set('rapport_type_id', String(typeId))
    q.set('rapport_id', String(rapport.id))
    return `/office/services/${sid}/table?${q}`
  }
  if (kind === 'commune_list') {
    const q = new URLSearchParams()
    if (typeId) q.set('rapport_type_id', String(typeId))
    q.set('rapport_id', String(rapport.id))
    return `/office/services/${sid}/communes?${q}`
  }
  if (kind === 'fiche_lecture' || kind === 'document_compose') {
    return `/office/rapports/${rapport.id}/document`
  }
  return `/office/rapports/${rapport.id}/document`
}

function notificationLink(n: any) {
  if (n.broadcast_id) return `/office/shared/${n.broadcast_id}`
  return rapportLink(n)
}

export function OfficeNotificationsBell({ token }: Props) {
  const { t } = useTranslation()
  const { counts } = useOfficeHubCounts(token)
  const unread = counts.unread_notifications
  const countLabel = unread > 99 ? '99+' : String(unread)
  const label =
    unread > 0 ? `${t('navNotifications')} (${countLabel})` : t('navNotifications')

  return (
    <Link
      className="btn btn-ghost notifBell"
      to="/office/notifications"
      title={label}
      aria-label={label}
    >
      <span className="notifBellIconWrap">
        <HubIcon name="notifications" className="notifBellIcon" />
        {unread > 0 ? (
          <span className="notifBellCount" aria-hidden="true">
            {countLabel}
          </span>
        ) : null}
      </span>
      <span className="notifBellLabel">{t('navNotifications')}</span>
    </Link>
  )
}

export function OfficeNotificationsPage({ token }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { counts, refresh } = useOfficeHubCounts(token)
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    try {
      const res = await api.listOfficeNotifications(token, false)
      setRows(res.notifications)
    } catch {
      /* ignore */
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  async function openNotification(n: any) {
    try {
      if (!n.read_at) {
        await api.markNotificationRead(token, n.id)
        notifyHubCountsRefresh()
        refresh()
      }
    } catch {
      /* ignore */
    }
    navigate(notificationLink(n))
  }

  function notificationBody(n: any) {
    const wr = n.waliResponse
    if (!wr) return null
    const text = waliResponseBodyText(wr.body_text)
    if (text) return text
    if (wr.decision) return waliDecisionLabel(wr.decision, t, wr.follow_up_status)
    return null
  }

  function messageLabel(n: any) {
    const key = n.message_key
    if (key === 'waliAccepted') return t('waliAccepted')
    if (key === 'waliAcceptedPending') return t('waliAcceptedPending')
    if (key === 'waliAcceptedCompleted') return t('waliAcceptedCompleted')
    if (key === 'waliChangesRequested') return t('waliChangesRequested')
    if (key === 'waliBroadcast') return t('waliBroadcast')
    if (key === 'waliBroadcastReminder') return t('waliBroadcastReminder')
    return t('navNotifications')
  }

  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row notificationPageHeader">
        <div className="notificationPageHeading">
          <h1>{t('navNotifications')}</h1>
          {counts.unread_notifications > 0 ? (
            <p className="muted small notificationPageSummary">
              {t('unread')}: {counts.unread_notifications}
            </p>
          ) : null}
        </div>
        <BackButton fallbackTo="/office" />
      </div>
      <div className="card notificationPageCard">
        {!rows.length ? <p className="muted notificationPageEmpty">{t('noResults')}</p> : null}
        <ul className="versionList notificationList">
          {pagedRows.map((n) => {
            const body = notificationBody(n)
            return (
            <li key={n.id} className={n.read_at ? 'read' : 'unread'}>
              <button type="button" className="notificationItem" onClick={() => openNotification(n)}>
                <span className="notificationItemHeader">
                  <strong>{messageLabel(n)}</strong>
                  {!n.read_at ? <span className="badge badge-submitted">{t('unread')}</span> : null}
                </span>
                <span className="notificationItemTitle">
                  {n.rapport?.title || n.broadcast?.title_ar || n.broadcast?.title_fr}
                </span>
                {body ? (
                  <span className="muted small notificationItemBody">{body}</span>
                ) : null}
                <span className="muted small notificationItemDate">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </button>
            </li>
            )
          })}
        </ul>
      </div>
      <TablePagination page={page} total={rows.length} onPageChange={setPage} />
    </div>
  )
}
