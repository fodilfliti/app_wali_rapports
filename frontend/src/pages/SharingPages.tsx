import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import {
  BroadcastCommentBlock,
  BroadcastFileCard,
  BroadcastReadProgress,
  BroadcastRecipientsPanel,
  SharedBroadcastListCard,
} from '../components/BroadcastSharedUi'
import { TablePagination } from '../components/TablePagination'
import { QueryListShell } from '../components/QueryListShell'
import { fileUrl, MediaUploadError, prepareFileForUpload } from '../utils/media'
import { UploadProgressBar } from '../components/UploadProgressBar'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import { useBroadcastsListQuery } from '../hooks/queries/useListQueries'
import { bilingualPairForSave, hasBilingualText, pickBilingualText } from '../utils/bilingual'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'

type Props = { token: string }

export function WaliBroadcastsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const listQuery = useBroadcastsListQuery(token, 'wali')
  const rows = listQuery.data ?? []
  const isInitialLoading = listQuery.isLoading && listQuery.data === undefined
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading
  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <Link className="btn btn-primary" to="/wali/shared/new">
          {t('shareFile')}
        </Link>
        <BackButton to="/wali" fallbackTo="/wali" />
      </div>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card sharedFilesPageCard">
        {!rows.length && !isInitialLoading ? <p className="muted sharedFilesPageEmpty">{t('noResults')}</p> : null}
        <div className="sharedFilesGrid">
          {pagedRows.map((b) => {
            const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
            const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)
            return (
              <SharedBroadcastListCard
                key={b.id}
                to={`/wali/shared/${b.id}`}
                title={title}
                message={message || undefined}
                file={b.file}
                createdAt={b.created_at}
                stats={b.stats}
              />
            )
          })}
        </div>
      </div>
      <TablePagination page={page} total={rows.length} onPageChange={setPage} />
      </QueryListShell>
    </div>
  )
}

export function WaliBroadcastCreatePage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const invalidate = useInvalidateAppQueries()
  const [users, setUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [titleAr, setTitleAr] = useState('')
  const [titleFr, setTitleFr] = useState('')
  const [message, setMessage] = useState('')
  const [allowComments, setAllowComments] = useState(true)
  const [uploadedFileId, setUploadedFileId] = useState<number | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
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

  async function handleFilePick(raw: File | null) {
    if (!raw) return
    setUploadError(null)
    setUploadedFileId(null)
    try {
      setCompressing(true)
      const prepared = await prepareFileForUpload(raw, { onCompressing: () => setCompressing(true) })
      setCompressing(false)
      setUploading(true)
      setUploadPercent(0)
      const res = await api.uploadWaliFile(token, prepared, {
        onProgress: (p) => setUploadPercent(p.percent),
      })
      setUploadedFileId(res.file.id)
      setUploadedFileName(res.file.original_name)
      setUploadPercent(100)
    } catch (e) {
      if (e instanceof MediaUploadError) {
        setUploadError(t(e.key, e.params))
      } else {
        setUploadError(t('mediaUploadFailed'))
      }
    } finally {
      setUploading(false)
      setCompressing(false)
    }
  }

  async function submit() {
    if (!uploadedFileId) {
      snack.show(t('fileRequired'), 'error')
      return
    }
    if (uploading || compressing) return
    if (!allUsers && selected.length === 0) {
      snack.show(t('shareRecipientsRequired'), 'error')
      return
    }
    if (!hasBilingualText(titleAr, titleFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      const titles = bilingualPairForSave(titleAr, titleFr)
      await api.createWaliBroadcast(token, {
        all_users: allUsers,
        recipient_user_ids: allUsers ? [] : selected,
        title_ar: titles.ar,
        title_fr: titles.fr,
        message_ar: message,
        message_fr: message,
        allow_comments: allowComments,
        uploaded_file_id: uploadedFileId,
      })
      await invalidate({ broadcasts: true, hubCounts: true })
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
        <BackButton to="/wali/shared" fallbackTo="/wali/shared" />
      </div>
      <div className="card formStack">
        <label className="formField">
          <span>{t('rapportTitle')} (AR)</span>
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
        </label>
        {ENABLE_FR_VALUE_INPUTS ? (
          <label className="formField">
            <span>{t('rapportTitle')} (FR)</span>
            <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
          </label>
        ) : null}
        <label className="formField">
          <span>{t('shareMessage')}</span>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label className="formField">
          <span>{t('shareFile')}</span>
          <input
            type="file"
            disabled={uploading || compressing}
            onChange={(e) => {
              void handleFilePick(e.target.files?.[0] || null)
              e.target.value = ''
            }}
          />
          {uploadedFileName ? <p className="muted small">{uploadedFileName}</p> : null}
          {compressing ? <p className="muted small">{t('mediaCompressing')}</p> : null}
          {uploading && !compressing ? (
            <UploadProgressBar percent={uploadPercent} label={t('mediaUploadProgress', { percent: uploadPercent })} />
          ) : null}
          {uploadError ? <p className="formErrorBlock">{uploadError}</p> : null}
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
  const [postingComment, setPostingComment] = useState(false)

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
    if (!comment.trim() || postingComment) return
    setPostingComment(true)
    try {
      await api.addWaliBroadcastComment(token, bid, comment)
      setComment('')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPostingComment(false)
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
  const recipients = [...(b.recipients || [])].sort((a, c) => {
    if (!a.read_at && c.read_at) return -1
    if (a.read_at && !c.read_at) return 1
    return String(a.user?.name || a.user?.username || '').localeCompare(
      String(c.user?.name || c.user?.username || ''),
      i18n.language,
    )
  })
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
        <BackButton to="/wali/shared" fallbackTo="/wali/shared" />
      </div>
      <div className="card broadcastDetailCard">
        <div className="broadcastDetailSection broadcastDetailHero">
          {message ? <p className="broadcastDetailMessage">{message}</p> : null}
          {b.file ? <BroadcastFileCard file={b.file} href={fileUrlStr} /> : null}
          <BroadcastReadProgress read={b.stats?.read} total={b.stats?.total} />
        </div>

        <BroadcastRecipientsPanel
          recipients={recipients}
          pagedRecipients={pagedRecipients}
          recipientPage={recipientPage}
          total={recipients.length}
          onPageChange={setRecipientPage}
        />

        {b.allow_comments ? (
          <div className="broadcastDetailSection">
            <h3>{t('comments')}</h3>
            <ul className="broadcastCommentList">
              {pagedComments.map((c: any) => (
                <BroadcastCommentBlock
                  key={c.id}
                  author={c.user?.name || c.user?.username}
                  body={c.body_text}
                />
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
                <BusyButton
                  type="button"
                  className="btn btn-primary"
                  onClick={sendComment}
                  busy={postingComment}
                  busyLabel={t('submitting')}
                  disabled={!comment.trim()}
                >
                  {t('addComment')}
                </BusyButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type SharedAudience = 'office' | 'chef'

type SharedFilesProps = Props & { audience?: SharedAudience }

function sharedBasePath(audience: SharedAudience) {
  return audience === 'chef' ? '/chef/shared' : '/office/shared'
}

function getBroadcast(token: string, id: number, audience: SharedAudience) {
  return audience === 'chef' ? api.getChefBroadcast(token, id) : api.getOfficeBroadcast(token, id)
}

function markBroadcastRead(token: string, id: number, audience: SharedAudience) {
  return audience === 'chef' ? api.markChefBroadcastRead(token, id) : api.markOfficeBroadcastRead(token, id)
}

function addBroadcastComment(token: string, id: number, body: string, audience: SharedAudience) {
  return audience === 'chef'
    ? api.addChefBroadcastComment(token, id, body)
    : api.addOfficeBroadcastComment(token, id, body)
}

export function OfficeSharedFilesPage({ token, audience = 'office' }: SharedFilesProps) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const base = sharedBasePath(audience)
  const hub = audience === 'chef' ? '/chef' : '/office'
  const listQuery = useBroadcastsListQuery(token, audience)
  const rows = listQuery.data ?? []
  const isInitialLoading = listQuery.isLoading && listQuery.data === undefined
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading
  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        <BackButton to={hub} fallbackTo={hub} />
      </div>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card sharedFilesPageCard">
        {!rows.length && !isInitialLoading ? <p className="muted sharedFilesPageEmpty">{t('noResults')}</p> : null}
        <div className="sharedFilesGrid">
          {pagedRows.map((b) => {
            const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
            const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)
            return (
              <SharedBroadcastListCard
                key={b.id}
                to={`${base}/${b.id}`}
                title={title}
                message={message || undefined}
                file={b.file}
                createdAt={b.created_at}
                readAt={b.read_at}
                showUnreadBadge
              />
            )
          })}
        </div>
      </div>
      <TablePagination page={page} total={rows.length} onPageChange={setPage} />
      </QueryListShell>
    </div>
  )
}

export function OfficeSharedFileDetailPage({ token, audience = 'office' }: SharedFilesProps) {
  const { id } = useParams()
  const bid = Number(id)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const [b, setB] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [commentPage, setCommentPage] = useState(1)
  const [postingComment, setPostingComment] = useState(false)
  const base = sharedBasePath(audience)

  const load = useCallback(async () => {
    if (!bid) return
    try {
      const res = await getBroadcast(token, bid, audience)
      setB(res.broadcast)
      if (!res.broadcast.read_at) {
        await markBroadcastRead(token, bid, audience)
        await invalidate({ hubCounts: audience === 'chef' ? 'chef' : 'office', broadcasts: true })
      }
    } catch {
      setB(null)
    }
  }, [token, bid, audience])

  useEffect(() => {
    load()
  }, [load])

  async function sendComment() {
    if (!comment.trim() || postingComment) return
    setPostingComment(true)
    try {
      await addBroadcastComment(token, bid, comment, audience)
      setComment('')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPostingComment(false)
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
        <BackButton to={base} fallbackTo={base} />
      </div>
      <div className="card broadcastDetailCard">
        <div className="broadcastDetailSection broadcastDetailHero">
          {message ? <p className="broadcastDetailMessage">{message}</p> : null}
          {b.file ? <BroadcastFileCard file={b.file} href={fileUrlStr} /> : null}
        </div>
        {b.allow_comments ? (
          <div className="broadcastDetailSection">
            <h3>{t('comments')}</h3>
            <ul className="broadcastCommentList">
              {pagedComments.map((c: any) => (
                <BroadcastCommentBlock
                  key={c.id}
                  author={c.user?.name || c.user?.username}
                  body={c.body_text}
                />
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
                <BusyButton
                  type="button"
                  className="btn btn-primary"
                  onClick={sendComment}
                  busy={postingComment}
                  busyLabel={t('submitting')}
                  disabled={!comment.trim()}
                >
                  {t('addComment')}
                </BusyButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
