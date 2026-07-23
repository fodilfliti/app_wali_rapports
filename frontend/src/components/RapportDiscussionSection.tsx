import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import { entityIdsEqual } from '../utils/entityIds'
import * as api from '../api'
import { ApiError } from '../api'
import { TablePagination } from './TablePagination'
import { useSnackbar } from '../snackbar/SnackbarContext'
import {
  useChefHubCounts,
  useOfficeHubCounts,
  useWaliHubCounts,
} from '../hooks/useHubCounts'
import {
  DISCUSSION_REFRESH_EVENT,
  HUB_COUNTS_REFRESH_EVENT,
  notifyHubCountsRefresh,
  type DiscussionRefreshDetail,
} from '../utils/hubCountsRefresh'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'
import type { ReviewerMode } from '../utils/reviewerMode'

type Props = {
  token: string
  rapportId: EntityIdParam
  /** office | chef | wali */
  mode: 'office' | ReviewerMode
  /** When false, hide section / unavailable */
  enabled?: boolean
  /** Specific version thread; omit = API defaults to current */
  versionId?: EntityIdParam | null
  /** Force read-only composer (e.g. archive) even if API would allow */
  readOnly?: boolean
}

/** Soft-check cadence when the tab is visible (covers users without Web Push). */
const DISCUSSION_SOFT_SYNC_MS = 25_000

function roleLabel(role: string | undefined, t: (k: string) => string) {
  if (role === 'CHEF_CABINET') return t('roleChefCabinet')
  if (role === 'WALI') return t('roleWali')
  if (role === 'ADMIN') return t('roleAdmin')
  return t('roleOffice')
}

function authorDisplayName(
  author: { name?: string | null; username?: string | null; role?: string; is_deleted?: boolean } | null | undefined,
  t: (k: string) => string,
) {
  if (!author || author.is_deleted || (!author.name && !author.username)) {
    return roleLabel(author?.role, t)
  }
  return author.name || author.username || roleLabel(author.role, t)
}

function listFn(mode: Props['mode']) {
  if (mode === 'chef') return api.listChefRapportComments
  if (mode === 'wali') return api.listWaliRapportComments
  return api.listOfficeRapportComments
}

function createFn(mode: Props['mode']) {
  if (mode === 'chef') return api.createChefRapportComment
  if (mode === 'wali') return api.createWaliRapportComment
  return api.createOfficeRapportComment
}

export function RapportDiscussionSection({
  token,
  rapportId,
  mode,
  enabled = true,
  versionId = null,
  readOnly = false,
}: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const sectionRef = useRef<HTMLElement | null>(null)
  const knownTotalRef = useRef(-1)
  const syncingRef = useRef(false)
  const [comments, setComments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(enabled)
  const [canComment, setCanComment] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Badge counts update without push (focus refetch) and with push (hub invalidate).
  // Rising unread_discussion while this thread is open → soft-sync the thread.
  const officeHub = useOfficeHubCounts(mode === 'office' ? token : '')
  const chefHub = useChefHubCounts(mode === 'chef' ? token : '')
  const waliHub = useWaliHubCounts(mode === 'wali' ? token : '')
  const unreadDiscussion =
    mode === 'chef'
      ? chefHub.counts.unread_discussion || 0
      : mode === 'wali'
        ? waliHub.counts.unread_discussion || 0
        : officeHub.counts.unread_discussion || 0
  const prevUnreadRef = useRef<number | null>(null)

  const load = useCallback(
    async (opts?: { refreshHub?: boolean; scroll?: boolean; pageOverride?: number }) => {
      if (!rapportId || !enabled) {
        setComments([])
        setAvailable(false)
        setCanComment(false)
        setLoading(false)
        knownTotalRef.current = -1
        return
      }
      const pageToLoad = opts?.pageOverride ?? page
      setLoading(true)
      try {
        const res = await listFn(mode)(token, rapportId, {
          page: pageToLoad,
          pageSize: DEFAULT_PAGE_SIZE,
          ...(versionId != null ? { versionId } : {}),
        })
        const nextTotal = res.total || 0
        setComments(res.comments || [])
        setTotal(nextTotal)
        knownTotalRef.current = nextTotal
        setAvailable(res.discussion_available !== false)
        setCanComment(
          !readOnly &&
            res.can_comment === true &&
            res.discussion_available !== false,
        )

        if (opts?.pageOverride != null && opts.pageOverride !== page) {
          setPage(opts.pageOverride)
        }
        if (opts?.refreshHub !== false) {
          void notifyHubCountsRefresh()
        }
        if (opts?.scroll) {
          requestAnimationFrame(() => {
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
            const thread = sectionRef.current?.querySelector('.discussionThread')
            const last = thread?.lastElementChild as HTMLElement | null
            last?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          })
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 409 || e.message === 'discussionNotAvailable')) {
          setAvailable(false)
          setCanComment(false)
          setComments([])
        } else {
          snack.show(t('errorGeneric'), 'error')
        }
      } finally {
        setLoading(false)
      }
    },
    [token, rapportId, mode, page, enabled, versionId, readOnly, snack, t],
  )

  /** Probe total; if new comments exist, jump to last page and optionally scroll. */
  const softSync = useCallback(
    async (opts?: { scroll?: boolean; force?: boolean }) => {
      if (!rapportId || !enabled || readOnly || syncingRef.current) return
      syncingRef.current = true
      try {
        const probe = await listFn(mode)(token, rapportId, {
          page: 1,
          pageSize: 1,
          ...(versionId != null ? { versionId } : {}),
        })
        const nextTotal = probe.total || 0
        const known = knownTotalRef.current
        if (!opts?.force && known >= 0 && nextTotal <= known) return
        const grew = known < 0 || nextTotal > known
        const lastPage = Math.max(1, Math.ceil(nextTotal / DEFAULT_PAGE_SIZE))
        await load({
          // Clear discussion badge after catching up while this page is open.
          refreshHub: grew || !!opts?.force,
          scroll: opts?.scroll !== false && grew,
          pageOverride: lastPage,
        })
      } catch {
        /* ignore background sync failures */
      } finally {
        syncingRef.current = false
      }
    },
    [token, rapportId, mode, enabled, readOnly, versionId, load],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
    knownTotalRef.current = -1
    prevUnreadRef.current = null
  }, [rapportId, versionId])

  // Push with rapport_id → immediate refresh.
  useEffect(() => {
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<DiscussionRefreshDetail>).detail
      if (!detail || !entityIdsEqual(detail.rapportId, rapportId)) return
      if (!enabled || readOnly) return
      void softSync({ scroll: true, force: true })
    }
    window.addEventListener(DISCUSSION_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(DISCUSSION_REFRESH_EVENT, onRefresh)
  }, [rapportId, enabled, readOnly, softSync])

  // Hub badge refresh (push without message_key, local invalidate, etc.).
  useEffect(() => {
    if (!enabled || readOnly) return
    const onHub = () => {
      void softSync({ scroll: true })
    }
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, onHub)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, onHub)
  }, [enabled, readOnly, softSync])

  // unread_discussion rose (focus refetch / push invalidate) while this page is open.
  useEffect(() => {
    if (!enabled || readOnly) return
    const prev = prevUnreadRef.current
    prevUnreadRef.current = unreadDiscussion
    if (prev == null) return
    if (unreadDiscussion > prev) {
      void softSync({ scroll: true })
    }
  }, [unreadDiscussion, enabled, readOnly, softSync])

  // No-push safety net: light probe while the tab is visible.
  useEffect(() => {
    if (!enabled || readOnly) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void softSync({ scroll: true })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void softSync({ scroll: true })
    }
    const id = window.setInterval(tick, DISCUSSION_SOFT_SYNC_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, readOnly, softSync])

  async function send() {
    const text = draft.trim()
    if (!text || sending || !available || !canComment) return
    setSending(true)
    try {
      await createFn(mode)(
        token,
        rapportId,
        text,
        versionId != null ? versionId : undefined,
      )
      setDraft('')
      const nextTotal = total + 1
      const lastPage = Math.max(1, Math.ceil(nextTotal / DEFAULT_PAGE_SIZE))
      await load({ pageOverride: lastPage, scroll: true })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setSending(false)
    }
  }

  if (!enabled || (!available && !loading && !comments.length)) {
    if (!enabled) return null
    return (
      <section className="section rapportDiscussionSection" ref={sectionRef}>
        <h2>{t('discussionTitle')}</h2>
        <p className="muted">{t('discussionNotAvailable')}</p>
      </section>
    )
  }

  return (
    <section className="section rapportDiscussionSection" ref={sectionRef}>
      <h2>{t('discussionTitle')}</h2>
      {available && (readOnly || !canComment) ? (
        <p className="muted small">{t('discussionReadOnlyHint')}</p>
      ) : null}
      {loading && !comments.length ? <p className="muted">…</p> : null}
      {!loading && !comments.length ? (
        <p className="muted discussionEmpty">{t('discussionEmpty')}</p>
      ) : null}
      <div className="discussionThread" role="log" aria-live="polite">
        {comments.map((c) => {
          const role = c.author?.role as string | undefined
          const roleClass =
            role === 'CHEF_CABINET'
              ? 'discussionMsg--chef'
              : role === 'WALI'
                ? 'discussionMsg--wali'
                : 'discussionMsg--office'
          return (
            <article key={c.id} className={`discussionMsg ${roleClass}`}>
              <header className="discussionMsgHead">
                <strong className="discussionMsgAuthor">
                  {authorDisplayName(c.author, t)}
                </strong>
                {!c.author?.is_deleted ? (
                  <span className="discussionMsgRole muted small">{roleLabel(role, t)}</span>
                ) : null}
                {c.created_at ? (
                  <time className="discussionMsgTime muted small" dateTime={c.created_at}>
                    {new Date(c.created_at).toLocaleString(
                      i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ',
                    )}
                  </time>
                ) : null}
              </header>
              <p className="discussionMsgBody">{c.body_text}</p>
            </article>
          )
        })}
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
      {available && canComment ? (
        <div className="discussionComposer">
          <label className="sr-only" htmlFor={`discussion-draft-${rapportId}`}>
            {t('discussionPlaceholder')}
          </label>
          <textarea
            id={`discussion-draft-${rapportId}`}
            className="discussionComposerInput"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('discussionPlaceholder')}
            maxLength={5000}
            disabled={sending}
          />
          <div className="discussionComposerActions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending || !draft.trim()}
              onClick={send}
            >
              {t('discussionSend')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Helper: discussion enabled after first Envoyer */
export function isDiscussionEnabledByStatus(status?: string | null) {
  return [
    'pending_chef',
    'submitted',
    'under_review',
    'changes_requested',
    'acknowledged',
  ].includes(String(status || ''))
}
