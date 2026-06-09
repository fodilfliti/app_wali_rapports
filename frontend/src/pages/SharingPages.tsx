import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { HubIcon } from '../components/HubIcons'
import { TablePagination } from '../components/TablePagination'
import { fileUrl } from '../utils/media'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { hasBilingualText, pickBilingualText } from '../utils/bilingual'

type Props = { token: string }

export function WaliBroadcastsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.listWaliBroadcasts(token).then((r) => setRows(r.broadcasts)).catch(() => {})
  }, [token])

  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <Link className="btn btn-primary" to="/wali/shared/new">
          {t('shareFile')}
        </Link>
        <BackButton fallbackTo="/wali" />
      </div>
      <div className="card sharedFilesPageCard">
        {!rows.length ? <p className="muted sharedFilesPageEmpty">{t('noResults')}</p> : null}
        <ul className="versionList sharedFilesList">
          {pagedRows.map((b) => {
            const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
            const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)
            return (
              <li key={b.id} className={b.read_at ? 'read' : 'unread'}>
                <Link to={`/wali/shared/${b.id}`} className="sharedFileItem">
                  <span className="sharedFileItemHeader">
                    <HubIcon name="shared" className="sharedFileItemIcon" />
                    <strong className="sharedFileItemTitle">{title}</strong>
                    <span className="muted small sharedFileItemMeta">
                      {b.stats?.read}/{b.stats?.total} {t('readCount')}
                    </span>
                  </span>
                  {message ? <span className="muted small sharedFileItemBody">{message}</span> : null}
                  {b.created_at ? (
                    <span className="muted small sharedFileItemDate">
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      <TablePagination page={page} total={rows.length} onPageChange={setPage} />
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
  const [userSearch, setUserSearch] = useState('')
  const [titleAr, setTitleAr] = useState('')
  const [titleFr, setTitleFr] = useState('')
  const [message, setMessage] = useState('')
  const [allowComments, setAllowComments] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [userPage, setUserPage] = useState(1)

  useEffect(() => {
    api.listWaliShareUsers(token).then((r) => setUsers(r.users)).catch(() => {})
  }, [token])

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    const name = String(u.name || '').toLowerCase()
    const username = String(u.username || '').toLowerCase()
    return name.includes(q) || username.includes(q)
  })

  useEffect(() => {
    setUserPage(1)
  }, [userSearch])

  const pagedFilteredUsers = paginateSlice(filteredUsers, userPage, DEFAULT_PAGE_SIZE)

  function toggleUser(userId: number, enabled: boolean) {
    setSelected((prev) => (enabled ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)))
  }

  function selectAllFiltered() {
    setSelected((prev) => [...new Set([...prev, ...filteredUsers.map((u) => Number(u.id))])])
  }

  function clearSelection() {
    setSelected([])
  }

  async function submit() {
    if (!file) {
      snack.show(t('fileRequired'), 'error')
      return
    }
    if (!allUsers && selected.length === 0) {
      snack.show(t('shareRecipientsRequired'), 'error')
      return
    }
    if (!hasBilingualText(titleAr, titleFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      await api.createWaliBroadcast(token, file, {
        all_users: allUsers,
        recipient_user_ids: allUsers ? [] : selected,
        title_ar: titleAr.trim() || titleFr.trim(),
        title_fr: titleFr.trim() || titleAr.trim(),
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
        <label className="formField">
          <span>{t('rapportTitle')} (AR)</span>
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </label>
        <label className="formField">
          <span>{t('rapportTitle')} (FR)</span>
          <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
        </label>
        <label className="formField">
          <span>{t('shareMessage')}</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="formField">
          <span>{t('shareFile')}</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <fieldset className="shareRecipientsSection">
          <legend className="shareRecipientsLegend">{t('shareRecipients')}</legend>
          <p className="muted small shareRecipientsHelp">{t('shareRecipientsHelp')}</p>
          <label className="formCheck">
            <input
              type="checkbox"
              checked={allUsers}
              onChange={(e) => {
                setAllUsers(e.target.checked)
                if (e.target.checked) setSelected([])
              }}
            />
            <span>{t('allOfficeUsers')}</span>
          </label>
          {!allUsers ? (
            <div className="recipientPanel">
              <div className="recipientToolbar">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t('shareSearchUsers')}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllFiltered}>
                  {t('shareSelectAll')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection}>
                  {t('shareClearSelection')}
                </button>
              </div>
              <p className="muted small recipientCount">
                {t('shareSelectedCount', { count: selected.length, total: users.length })}
              </p>
              <ul className="recipientList">
                {pagedFilteredUsers.length ? (
                  pagedFilteredUsers.map((u) => {
                    const userId = Number(u.id)
                    const checked = selected.includes(userId)
                    return (
                      <li key={u.id}>
                        <label className={`formCheck recipientRow${checked ? ' selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleUser(userId, e.target.checked)}
                          />
                          <span className="recipientRowMain">
                            <strong>{u.name || u.username}</strong>
                            {u.name ? <span className="muted small">{u.username}</span> : null}
                          </span>
                        </label>
                      </li>
                    )
                  })
                ) : (
                  <li className="recipientEmpty muted small">{t('noResults')}</li>
                )}
              </ul>
              <TablePagination page={userPage} total={filteredUsers.length} onPageChange={setUserPage} compact />
            </div>
          ) : null}
        </fieldset>

        <label className="formCheck">
          <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
          <span>{t('allowComments')}</span>
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
  const [recipientPage, setRecipientPage] = useState(1)
  const [commentPage, setCommentPage] = useState(1)

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

  if (!b) {
    return (
      <div className="page">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }
  const fileUrlStr = b.file ? fileUrl(token, b.file) : ''
  const recipients = b.recipients || []
  const comments = b.comments || []
  const pagedRecipients = paginateSlice(recipients, recipientPage, DEFAULT_PAGE_SIZE)
  const pagedComments = paginateSlice(comments, commentPage, DEFAULT_PAGE_SIZE)
  const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
  const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{title}</h1>
        <button type="button" className="btn btn-secondary" onClick={remind}>
          {t('remindUnread')}
        </button>
        <BackButton fallbackTo="/wali/shared" />
      </div>
      <div className="card broadcastDetailCard">
        <div className="broadcastDetailSection">
          {message ? <p className="broadcastDetailMessage">{message}</p> : null}
          {b.file ? (
            <a className="broadcastDetailFile" href={fileUrlStr} target="_blank" rel="noreferrer">
              {b.file.original_name}
            </a>
          ) : null}
          <p className="broadcastDetailStats muted">
            {t('readCount')}: {b.stats?.read}/{b.stats?.total}
          </p>
        </div>

        <div className="broadcastDetailSection">
          <h3>{t('whoViewed')}</h3>
          <ul className="broadcastDetailList">
            {pagedRecipients.map((r: any) => (
              <li key={r.user.id}>
                <span>{r.user.name || r.user.username}</span>
                <span className={r.read_at ? 'muted' : 'badge badge-submitted'}>
                  {r.read_at ? new Date(r.read_at).toLocaleString() : t('unread')}
                </span>
              </li>
            ))}
          </ul>
          {!recipients.length ? <p className="muted small">{t('noResults')}</p> : null}
          <TablePagination page={recipientPage} total={recipients.length} onPageChange={setRecipientPage} compact />
        </div>

        {b.allow_comments ? (
          <div className="broadcastDetailSection">
            <h3>{t('comments')}</h3>
            <ul className="broadcastDetailList broadcastCommentList">
              {pagedComments.map((c: any) => (
                <li key={c.id}>
                  <strong>{c.user?.name || c.user?.username}</strong>
                  <p>{c.body_text}</p>
                </li>
              ))}
            </ul>
            {!comments.length ? <p className="muted small">{t('noResults')}</p> : null}
            <TablePagination page={commentPage} total={comments.length} onPageChange={setCommentPage} compact />
            <div className="broadcastCommentForm">
              <label className="broadcastCommentField">
                <span className="fieldLabel">{t('addComment')}</span>
                <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <div className="broadcastCommentActions">
                <button type="button" className="btn btn-primary" onClick={sendComment} disabled={!comment.trim()}>
                  {t('addComment')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function OfficeSharedFilesPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.listOfficeBroadcasts(token).then((r) => setRows(r.broadcasts)).catch(() => {})
  }, [token])

  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <BackButton fallbackTo="/office" />
      </div>
      <div className="card sharedFilesPageCard">
        {!rows.length ? <p className="muted sharedFilesPageEmpty">{t('noResults')}</p> : null}
        <ul className="versionList sharedFilesList">
          {pagedRows.map((b) => {
            const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
            const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)
            return (
              <li key={b.id} className={b.read_at ? 'read' : 'unread'}>
                <Link to={`/office/shared/${b.id}`} className="sharedFileItem">
                  <span className="sharedFileItemHeader">
                    <HubIcon name="shared" className="sharedFileItemIcon" />
                    <strong className="sharedFileItemTitle">{title}</strong>
                    {!b.read_at ? <span className="badge badge-submitted">{t('unread')}</span> : null}
                  </span>
                  {message ? <span className="muted small sharedFileItemBody">{message}</span> : null}
                  {b.file?.original_name ? (
                    <span className="muted small sharedFileItemFile">{b.file.original_name}</span>
                  ) : null}
                  {b.created_at ? (
                    <span className="muted small sharedFileItemDate">
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      <TablePagination page={page} total={rows.length} onPageChange={setPage} />
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
  const [commentPage, setCommentPage] = useState(1)

  const load = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.getOfficeBroadcast(token, bid)
      setB(res.broadcast)
      if (!res.broadcast.read_at) {
        await api.markOfficeBroadcastRead(token, bid)
        notifyHubCountsRefresh()
      }
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

  if (!b) {
    return (
      <div className="page">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }
  const fileUrlStr = b.file ? fileUrl(token, b.file) : ''
  const comments = b.comments || []
  const pagedComments = paginateSlice(comments, commentPage, DEFAULT_PAGE_SIZE)
  const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
  const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{title}</h1>
        <BackButton fallbackTo="/office/shared" />
      </div>
      <div className="card broadcastDetailCard">
        <div className="broadcastDetailSection">
          {message ? <p className="broadcastDetailMessage">{message}</p> : null}
          {b.file ? (
            <a className="broadcastDetailFile" href={fileUrlStr} target="_blank" rel="noreferrer">
              {b.file.original_name}
            </a>
          ) : null}
        </div>
        {b.allow_comments ? (
          <div className="broadcastDetailSection">
            <h3>{t('comments')}</h3>
            <ul className="broadcastDetailList broadcastCommentList">
              {pagedComments.map((c: any) => (
                <li key={c.id}>
                  <strong>{c.user?.name || c.user?.username}</strong>
                  <p>{c.body_text}</p>
                </li>
              ))}
            </ul>
            {!comments.length ? <p className="muted small">{t('noResults')}</p> : null}
            <TablePagination page={commentPage} total={comments.length} onPageChange={setCommentPage} compact />
            <div className="broadcastCommentForm">
              <label className="broadcastCommentField">
                <span className="fieldLabel">{t('addComment')}</span>
                <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <div className="broadcastCommentActions">
                <button type="button" className="btn btn-primary" onClick={sendComment} disabled={!comment.trim()}>
                  {t('addComment')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
