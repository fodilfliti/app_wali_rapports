import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import {
  BroadcastCommentBlock,
  BroadcastFileCard,
  BroadcastReadProgress,
  BroadcastRecipientsPanel,
  SharedBroadcastListCard,
  SharedUploaderTag,
} from '../components/BroadcastSharedUi'
import { CreatorRecipientPicker } from '../components/CreatorRecipientPicker'
import { TablePagination } from '../components/TablePagination'
import { QueryListShell } from '../components/QueryListShell'
import { useSignedFileUrl } from '../hooks/useSignedFileUrl'
import { MediaUploadError, prepareFileForUpload } from '../utils/media'
import { UploadProgressBar } from '../components/UploadProgressBar'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import { useBroadcastsListQuery } from '../hooks/queries/useListQueries'
import { bilingualPairForSave, hasBilingualText, pickBilingualText } from '../utils/bilingual'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import type { EntityIdParam } from '../api'
import { asEntityId } from '../utils/entityIds'
import { paths } from '@wali/routes'

type Props = { token: string }
type ShareHub = 'wali' | 'chef'

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
        <Link className="btn btn-primary" to={paths.hub.path('wali', 'shared', 'new')}>
          {t('shareFile')}
        </Link>
        <BackButton to={paths.hub.home('wali')} fallbackTo={paths.hub.home('wali')} />
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
                to={paths.hub.path('wali', 'shared', String(b.id))}
                title={title}
                message={message || undefined}
                file={b.file}
                createdAt={b.created_at}
                createdByRole={b.created_by?.role}
                readAt={b.read_at}
                stats={b.stats}
                showUnreadBadge={b.created_by?.role === 'CHEF_CABINET'}
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

export function WaliBroadcastCreatePage({ token, hub = 'wali' }: Props & { hub?: ShareHub }) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const invalidate = useInvalidateAppQueries()
  const isChefHub = hub === 'chef'
  const [users, setUsers] = useState<any[]>([])
  /** Chef: attachés only by default; Wali create: all creator roles. */
  const [allOffice, setAllOffice] = useState(true)
  const [allDaira, setAllDaira] = useState(!isChefHub)
  const [allCommune, setAllCommune] = useState(!isChefHub)
  const [allDirection, setAllDirection] = useState(!isChefHub)
  const [allWali, setAllWali] = useState(false)
  const [selected, setSelected] = useState<EntityIdParam[]>([])
  const [titleAr, setTitleAr] = useState('')
  const [titleFr, setTitleFr] = useState('')
  const [message, setMessage] = useState('')
  const [allowComments, setAllowComments] = useState(true)
  const [uploadedFileId, setUploadedFileId] = useState<EntityIdParam | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'scanning'>('uploading')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const listPath = paths.hub.path(hub, 'shared')
  const anyAllRole =
    allOffice || allDaira || allCommune || allDirection || (isChefHub && allWali)

  useEffect(() => {
    const load = hub === 'chef' ? api.listChefShareUsers : api.listWaliShareUsers
    load(token).then((r) => setUsers(r.users)).catch(() => {})
  }, [token, hub])

  async function handleFilePick(raw: File | null) {
    if (!raw) return
    setUploadError(null)
    setUploadedFileId(null)
    try {
      setCompressing(true)
      const prepared = await prepareFileForUpload(raw, { onCompressing: () => setCompressing(true) })
      setCompressing(false)
      setUploading(true)
      setUploadPhase('uploading')
      setUploadPercent(0)
      const upload = hub === 'chef' ? api.uploadChefFile : api.uploadWaliFile
      const res = await upload(token, prepared, {
        onProgress: (p) => {
          setUploadPercent(p.percent)
          setUploadPhase(p.phase === 'scanning' ? 'scanning' : 'uploading')
        },
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
      setUploadPhase('uploading')
    }
  }

  async function submit() {
    if (!uploadedFileId) {
      snack.show(t('fileRequired'), 'error')
      return
    }
    if (uploading || compressing) return
    if (!anyAllRole && selected.length === 0) {
      snack.show(t('shareRecipientsRequired'), 'error')
      return
    }
    if (!hasBilingualText(titleAr, titleFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      const titles = bilingualPairForSave(titleAr, titleFr)
      const body = {
        all_office: allOffice,
        all_daira: allDaira,
        all_commune: allCommune,
        all_direction: allDirection,
        ...(isChefHub ? { all_wali: allWali } : {}),
        recipient_user_ids: selected,
        title_ar: titles.ar,
        title_fr: titles.fr,
        message_ar: message,
        message_fr: message,
        allow_comments: allowComments,
        uploaded_file_id: uploadedFileId,
      }
      if (hub === 'chef') {
        await api.createChefBroadcast(token, body)
      } else {
        await api.createWaliBroadcast(token, body)
      }
      await invalidate({ broadcasts: true, hubCounts: true })
      snack.show(t('save'), 'success')
      navigate(listPath)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('shareFile')}</h1>
        <BackButton to={listPath} fallbackTo={listPath} />
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
            <UploadProgressBar
              percent={uploadPercent}
              phase={uploadPhase}
              label={
                uploadPhase === 'scanning'
                  ? t('mediaScanning')
                  : t('mediaUploadProgress', { percent: uploadPercent })
              }
            />
          ) : null}
          {uploadError ? <p className="formErrorBlock">{uploadError}</p> : null}
        </label>

        <CreatorRecipientPicker
          users={users}
          flags={{ allOffice, allDaira, allCommune, allDirection, allWali }}
          onFlagsChange={(next) => {
            if (next.allOffice !== undefined) setAllOffice(next.allOffice)
            if (next.allDaira !== undefined) setAllDaira(next.allDaira)
            if (next.allCommune !== undefined) setAllCommune(next.allCommune)
            if (next.allDirection !== undefined) setAllDirection(next.allDirection)
            if (next.allWali !== undefined) setAllWali(next.allWali)
          }}
          selected={selected}
          onSelectedChange={setSelected}
          legendKey="shareRecipients"
          helpKey="shareRecipientsHelpLinked"
          showWaliBulk={isChefHub}
        />

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

export function WaliBroadcastDetailPage({ token, hub = 'wali' }: Props & { hub?: ShareHub }) {
  const { id } = useParams()
  const bid = asEntityId(id)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const [b, setB] = useState<any>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadErrorKey, setLoadErrorKey] = useState('errorGeneric')
  const [comment, setComment] = useState('')
  const [recipientPage, setRecipientPage] = useState(1)
  const [commentPage, setCommentPage] = useState(1)
  const [postingComment, setPostingComment] = useState(false)
  const sharedList = paths.hub.path(hub, 'shared')
  const isCreatorView = hub === 'wali' || hub === 'chef'

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!bid) {
      setLoadState('error')
      setLoadErrorKey('noResults')
      setB(null)
      return
    }
    if (!opts?.silent) setLoadState('loading')
    try {
      const res =
        hub === 'chef'
          ? await api.getChefBroadcast(token, bid)
          : await api.getWaliBroadcast(token, bid)
      setB(res.broadcast)
      setLoadState('ready')
      const fromOther =
        (hub === 'wali' && res.broadcast.created_by?.role === 'CHEF_CABINET') ||
        (hub === 'chef' && res.broadcast.created_by?.role === 'WALI')
      if (fromOther && res.broadcast.read_at == null) {
        if (hub === 'chef') {
          await api.markChefBroadcastRead(token, bid)
        } else {
          await api.markWaliBroadcastRead(token, bid)
        }
        await invalidate({ hubCounts: hub === 'chef' ? 'chef' : 'wali', broadcasts: true })
        const refreshed =
          hub === 'chef'
            ? await api.getChefBroadcast(token, bid)
            : await api.getWaliBroadcast(token, bid)
        setB(refreshed.broadcast)
      }
    } catch (e) {
      if (opts?.silent) {
        snack.show(t('errorGeneric'), 'error')
        return
      }
      setB(null)
      setLoadState('error')
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
        setLoadErrorKey('noResults')
      } else {
        setLoadErrorKey('errorGeneric')
      }
    }
  }, [token, bid, hub, invalidate, snack, t])

  useEffect(() => {
    void load()
  }, [load])

  const fileUrlStr = useSignedFileUrl(b?.file?.url_path)

  async function remind() {
    try {
      const r =
        hub === 'chef'
          ? await api.remindChefBroadcastUnread(token, bid!)
          : await api.remindBroadcastUnread(token, bid!)
      snack.show(`${t('remindUnread')}: ${r.reminded}`, 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function sendComment() {
    if (!comment.trim() || postingComment || !bid) return
    setPostingComment(true)
    try {
      const res =
        hub === 'chef'
          ? await api.addChefBroadcastComment(token, bid, comment)
          : await api.addWaliBroadcastComment(token, bid, comment)
      setComment('')
      if (res.broadcast) {
        setB(res.broadcast)
        setLoadState('ready')
      } else {
        await load({ silent: true })
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPostingComment(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="page">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }
  if (loadState === 'error' || !b) {
    return (
      <div className="page">
        <div className="pageHeader row">
          <h1>{t('navSharedFiles')}</h1>
          <BackButton to={sharedList} fallbackTo={sharedList} />
        </div>
        <p className="muted">{t(loadErrorKey)}</p>
      </div>
    )
  }
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
  const showRemind = isCreatorView && b.stats != null

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{title}</h1>
        {showRemind ? (
          <button type="button" className="btn btn-secondary" onClick={remind}>
            {t('remindUnread')}
          </button>
        ) : null}
        <BackButton to={sharedList} fallbackTo={sharedList} />
      </div>
      <div className="card broadcastDetailCard">
        <div className="broadcastDetailSection broadcastDetailHero">
          <SharedUploaderTag role={b.created_by?.role} className="broadcastDetailUploaderTag" />
          {message ? <p className="broadcastDetailMessage">{message}</p> : null}
          {b.file ? <BroadcastFileCard file={b.file} href={fileUrlStr} /> : null}
          {b.stats ? <BroadcastReadProgress read={b.stats?.read} total={b.stats?.total} /> : null}
        </div>

        {recipients.length ? (
          <BroadcastRecipientsPanel
            recipients={recipients}
            pagedRecipients={pagedRecipients}
            recipientPage={recipientPage}
            total={recipients.length}
            onPageChange={setRecipientPage}
          />
        ) : null}

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
  return audience === 'chef' ? paths.hub.path('chef', 'shared') : paths.hub.path('office', 'shared')
}

function getBroadcast(token: string, id: EntityIdParam, audience: SharedAudience) {
  return audience === 'chef' ? api.getChefBroadcast(token, id) : api.getOfficeBroadcast(token, id)
}

function markBroadcastRead(token: string, id: EntityIdParam, audience: SharedAudience) {
  return audience === 'chef' ? api.markChefBroadcastRead(token, id) : api.markOfficeBroadcastRead(token, id)
}

function addBroadcastComment(token: string, id: EntityIdParam, body: string, audience: SharedAudience) {
  return audience === 'chef'
    ? api.addChefBroadcastComment(token, id, body)
    : api.addOfficeBroadcastComment(token, id, body)
}

export function OfficeSharedFilesPage({ token, audience = 'office' }: SharedFilesProps) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const base = sharedBasePath(audience)
  const hub = audience === 'chef' ? paths.hub.home('chef') : paths.hub.home('office')
  const listQuery = useBroadcastsListQuery(token, audience)
  const rows = listQuery.data ?? []
  const isInitialLoading = listQuery.isLoading && listQuery.data === undefined
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading
  const pagedRows = paginateSlice(rows, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navSharedFiles')}</h1>
        {audience === 'chef' ? (
          <Link className="btn btn-primary" to={paths.hub.path('chef', 'shared', 'new')}>
            {t('shareFile')}
          </Link>
        ) : null}
        <BackButton to={hub} fallbackTo={hub} />
      </div>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card sharedFilesPageCard">
        {!rows.length && !isInitialLoading ? <p className="muted sharedFilesPageEmpty">{t('noResults')}</p> : null}
        <div className="sharedFilesGrid">
          {pagedRows.map((b) => {
            const title = pickBilingualText(b.title_ar, b.title_fr, i18n.language)
            const message = pickBilingualText(b.message_ar, b.message_fr, i18n.language)
            const isOwnChef = audience === 'chef' && b.created_by?.role === 'CHEF_CABINET'
            return (
              <SharedBroadcastListCard
                key={b.id}
                to={`${base}/${b.id}`}
                title={title}
                message={message || undefined}
                file={b.file}
                createdAt={b.created_at}
                createdByRole={b.created_by?.role}
                readAt={b.read_at}
                stats={b.stats}
                showUnreadBadge={!isOwnChef}
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
  const bid = asEntityId(id)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const [b, setB] = useState<any>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadErrorKey, setLoadErrorKey] = useState('errorGeneric')
  const [comment, setComment] = useState('')
  const [commentPage, setCommentPage] = useState(1)
  const [postingComment, setPostingComment] = useState(false)
  const base = sharedBasePath(audience)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!bid) {
      setLoadState('error')
      setLoadErrorKey('noResults')
      setB(null)
      return
    }
    if (!opts?.silent) setLoadState('loading')
    try {
      const res = await getBroadcast(token, bid, audience)
      setB(res.broadcast)
      setLoadState('ready')
      if (!res.broadcast.read_at) {
        await markBroadcastRead(token, bid, audience)
        await invalidate({ hubCounts: audience === 'chef' ? 'chef' : 'office', broadcasts: true })
      }
    } catch (e) {
      if (opts?.silent) {
        snack.show(t('errorGeneric'), 'error')
        return
      }
      setB(null)
      setLoadState('error')
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
        setLoadErrorKey('noResults')
      } else {
        setLoadErrorKey('errorGeneric')
      }
    }
  }, [token, bid, audience, invalidate, snack, t])

  useEffect(() => {
    void load()
  }, [load])

  const fileUrlStr = useSignedFileUrl(b?.file?.url_path)

  async function sendComment() {
    if (!comment.trim() || postingComment || !bid) return
    setPostingComment(true)
    try {
      const res = await addBroadcastComment(token, bid, comment, audience)
      setComment('')
      if (res.broadcast) {
        setB(res.broadcast)
        setLoadState('ready')
      } else {
        await load({ silent: true })
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPostingComment(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="page">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }
  if (loadState === 'error' || !b) {
    return (
      <div className="page">
        <div className="pageHeader row">
          <h1>{t('navSharedFiles')}</h1>
          <BackButton to={base} fallbackTo={base} />
        </div>
        <p className="muted">{t(loadErrorKey)}</p>
      </div>
    )
  }
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
          <SharedUploaderTag role={b.created_by?.role} className="broadcastDetailUploaderTag" />
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
