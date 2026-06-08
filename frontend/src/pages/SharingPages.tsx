import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { HubTile } from '../components/HubTile'
import { fileUrl } from '../utils/media'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = { token: string }

export function WaliBroadcastsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    api.listWaliBroadcasts(token).then((r) => setRows(r.broadcasts)).catch(() => {})
  }, [token])

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <Link className="btn btn-primary" to="/wali/shared/new">
          {t('shareFile')}
        </Link>
        <BackButton fallbackTo="/wali" />
      </div>
      <div className="hubGrid">
        {rows.map((b) => (
          <HubTile
            key={b.id}
            to={`/wali/shared/${b.id}`}
            icon="shared"
            title={i18n.language === 'fr' ? b.title_fr || b.title_ar : b.title_ar || b.title_fr}
            subtitle={`${b.stats?.read}/${b.stats?.total} ${t('readCount')}`}
          />
        ))}
      </div>
      {!rows.length ? <p className="muted">{t('noResults')}</p> : null}
    </div>
  )
}

export function WaliBroadcastCreatePage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [users, setUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [titleAr, setTitleAr] = useState('')
  const [titleFr, setTitleFr] = useState('')
  const [message, setMessage] = useState('')
  const [allowComments, setAllowComments] = useState(true)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    api.listWaliShareUsers(token).then((r) => setUsers(r.users)).catch(() => {})
  }, [token])

  async function submit() {
    if (!file) {
      snack.show(t('fileRequired'), 'error')
      return
    }
    try {
      await api.createWaliBroadcast(token, file, {
        all_users: allUsers,
        recipient_user_ids: allUsers ? [] : selected,
        title_ar: titleAr,
        title_fr: titleFr,
        message_ar: message,
        message_fr: message,
        allow_comments: allowComments,
      })
      snack.show(t('save'), 'success')
      navigate('/wali/shared')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('shareFile')}</h1>
        <BackButton fallbackTo="/wali/shared" />
      </div>
      <div className="card formStack">
        <label>
          {t('rapportTitle')} (AR)
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </label>
        <label>
          {t('rapportTitle')} (FR)
          <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
        </label>
        <label>
          {t('shareMessage')}
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <label>
          <input type="checkbox" checked={allUsers} onChange={(e) => setAllUsers(e.target.checked)} /> {t('allOfficeUsers')}
        </label>
        {!allUsers ? (
          <div className="recipientPick">
            {users.map((u) => (
              <label key={u.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                  }
                />
                {u.name || u.username}
              </label>
            ))}
          </div>
        ) : null}
        <label>
          <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />{' '}
          {t('allowComments')}
        </label>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {t('shareFile')}
        </button>
      </div>
    </div>
  )
}

export function WaliBroadcastDetailPage({ token }: Props) {
  const { id } = useParams()
  const bid = Number(id)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [b, setB] = useState<any>(null)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.getWaliBroadcast(token, bid)
      setB(res.broadcast)
    } catch {
      setB(null)
    }
  }, [token, bid])

  useEffect(() => {
    load()
  }, [load])

  async function remind() {
    try {
      const r = await api.remindBroadcastUnread(token, bid)
      snack.show(`${t('remindUnread')}: ${r.reminded}`, 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function sendComment() {
    try {
      await api.addWaliBroadcastComment(token, bid, comment)
      setComment('')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  if (!b) return null
  const fileUrlStr = b.file ? fileUrl(token, b.file) : ''

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{i18n.language === 'fr' ? b.title_fr || b.title_ar : b.title_ar || b.title_fr}</h1>
        <button type="button" className="btn btn-secondary" onClick={remind}>
          {t('remindUnread')}
        </button>
        <BackButton fallbackTo="/wali/shared" />
      </div>
      <div className="card">
        <p>{i18n.language === 'fr' ? b.message_fr : b.message_ar}</p>
        {b.file ? (
          <a className="btn btn-ghost" href={fileUrlStr} target="_blank" rel="noreferrer">
            {b.file.original_name}
          </a>
        ) : null}
        <p className="muted">
          {t('readCount')}: {b.stats?.read}/{b.stats?.total}
        </p>
        <h3>{t('whoViewed')}</h3>
        <ul>
          {(b.recipients || []).map((r: any) => (
            <li key={r.user.id}>
              {r.user.name || r.user.username} — {r.read_at ? new Date(r.read_at).toLocaleString() : t('unread')}
            </li>
          ))}
        </ul>
        {b.allow_comments ? (
          <>
            <h3>{t('comments')}</h3>
            <ul>
              {(b.comments || []).map((c: any) => (
                <li key={c.id}>
                  <strong>{c.user?.name}</strong>: {c.body_text}
                </li>
              ))}
            </ul>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={sendComment}>
              {t('addComment')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function OfficeSharedFilesPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    api.listOfficeBroadcasts(token).then((r) => setRows(r.broadcasts)).catch(() => {})
  }, [token])

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <BackButton fallbackTo="/office" />
      </div>
      <div className="hubGrid">
        {rows.map((b) => (
          <HubTile
            key={b.id}
            to={`/office/shared/${b.id}`}
            icon="shared"
            title={i18n.language === 'fr' ? b.title_fr || b.title_ar : b.title_ar || b.title_fr}
            badge={!b.read_at ? <span className="badge badge-submitted">{t('unread')}</span> : undefined}
          />
        ))}
      </div>
      {!rows.length ? <p className="muted">{t('noResults')}</p> : null}
    </div>
  )
}

export function OfficeSharedFileDetailPage({ token }: Props) {
  const { id } = useParams()
  const bid = Number(id)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [b, setB] = useState<any>(null)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.getOfficeBroadcast(token, bid)
      setB(res.broadcast)
      if (!res.broadcast.read_at) await api.markOfficeBroadcastRead(token, bid)
    } catch {
      setB(null)
    }
  }, [token, bid])

  useEffect(() => {
    load()
  }, [load])

  async function sendComment() {
    try {
      await api.addOfficeBroadcastComment(token, bid, comment)
      setComment('')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  if (!b) return null
  const fileUrlStr = b.file ? fileUrl(token, b.file) : ''

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{i18n.language === 'fr' ? b.title_fr || b.title_ar : b.title_ar || b.title_fr}</h1>
        <BackButton fallbackTo="/office/shared" />
      </div>
      <div className="card">
        <p>{i18n.language === 'fr' ? b.message_fr : b.message_ar}</p>
        {b.file ? (
          <a className="btn btn-ghost" href={fileUrlStr} target="_blank" rel="noreferrer">
            {b.file.original_name}
          </a>
        ) : null}
        {b.allow_comments ? (
          <>
            <h3>{t('comments')}</h3>
            <ul>
              {(b.comments || []).map((c: any) => (
                <li key={c.id}>
                  <strong>{c.user?.name}</strong>: {c.body_text}
                </li>
              ))}
            </ul>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={sendComment}>
              {t('addComment')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
