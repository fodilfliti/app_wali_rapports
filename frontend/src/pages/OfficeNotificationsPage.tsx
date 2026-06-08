import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'

type Props = { token: string }

function rapportLink(n: any) {
  const rapport = n.rapport
  if (!rapport) return '/office/rapports'
  const kind = rapport.rapportType?.content_kind
  const sid = rapport.service_id
  if (kind === 'table_grid') return `/office/services/${sid}/table`
  if (kind === 'commune_list') return `/office/services/${sid}/communes`
  if (kind === 'fiche_lecture') return `/office/services/${sid}/fiches`
  return `/office/rapports/${rapport.id}/document`
}

function notificationLink(n: any) {
  if (n.broadcast_id) return `/office/shared/${n.broadcast_id}`
  return rapportLink(n)
}

export function OfficeNotificationsBell({ token }: Props) {
  const { t } = useTranslation()
  const [count, setCount] = useState(0)

  useEffect(() => {
    api.listOfficeNotifications(token, true).then((r) => setCount(r.notifications.length)).catch(() => {})
  }, [token])

  return (
    <Link className="btn btn-ghost notifBell" to="/office/notifications" title={t('navNotifications')}>
      {t('navNotifications')}
      {count > 0 ? <span className="badge badge-submitted notifCount">{count}</span> : null}
    </Link>
  )
}

export function OfficeNotificationsPage({ token }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<any[]>([])

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
      if (!n.read_at) await api.markNotificationRead(token, n.id)
    } catch {
      /* ignore */
    }
    navigate(notificationLink(n))
  }

  function messageLabel(n: any) {
    const key = n.message_key
    if (key === 'waliAccepted') return t('waliAccepted')
    if (key === 'waliChangesRequested') return t('waliChangesRequested')
    if (key === 'waliBroadcast') return t('waliBroadcast')
    if (key === 'waliBroadcastReminder') return t('waliBroadcastReminder')
    return t('navNotifications')
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navNotifications')}</h1>
        <BackButton fallbackTo="/office" />
      </div>
      <div className="card">
        <ul className="versionList notificationList">
          {rows.map((n) => (
            <li key={n.id} className={n.read_at ? 'read' : 'unread'}>
              <button type="button" className="notificationItem" onClick={() => openNotification(n)}>
                <strong>{messageLabel(n)}</strong>
                <span>{n.rapport?.title || n.broadcast?.title_ar || n.broadcast?.title_fr}</span>
                {n.waliResponse?.body_text ? <span className="muted small">{n.waliResponse.body_text}</span> : null}
                <span className="muted small">{new Date(n.created_at).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
        {!rows.length ? <p className="muted">{t('noResults')}</p> : null}
      </div>
    </div>
  )
}
