import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { TablePagination } from './TablePagination'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'
import type { ReviewerMode } from '../utils/reviewerMode'

type Props = {
  token: string
  rapportId: number
  /** office | chef | wali */
  mode: 'office' | ReviewerMode
  /** When false, hide composer and show unavailable hint */
  enabled?: boolean
}

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

export function RapportDiscussionSection({ token, rapportId, mode, enabled = true }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [comments, setComments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(enabled)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!rapportId || !enabled) {
      setComments([])
      setAvailable(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listFn(mode)(token, rapportId, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setComments(res.comments || [])
      setTotal(res.total || 0)
      setAvailable(res.discussion_available !== false)
      notifyHubCountsRefresh()
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.message === 'discussionNotAvailable')) {
        setAvailable(false)
        setComments([])
      } else {
        snack.show(t('errorGeneric'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [token, rapportId, mode, page, enabled, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function send() {
    const text = draft.trim()
    if (!text || sending || !available) return
    setSending(true)
    try {
      const { comment } = await createFn(mode)(token, rapportId, text)
      setDraft('')
      if (page !== Math.max(1, Math.ceil((total + 1) / DEFAULT_PAGE_SIZE))) {
        setPage(Math.max(1, Math.ceil((total + 1) / DEFAULT_PAGE_SIZE)))
      } else {
        setComments((prev) => [...prev, comment])
        setTotal((n) => n + 1)
      }
      await notifyHubCountsRefresh()
      await load()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setSending(false)
    }
  }

  if (!enabled || (!available && !loading && !comments.length)) {
    if (!enabled) return null
    return (
      <section className="section rapportDiscussionSection">
        <h2>{t('discussionTitle')}</h2>
        <p className="muted">{t('discussionNotAvailable')}</p>
      </section>
    )
  }

  return (
    <section className="section rapportDiscussionSection">
      <h2>{t('discussionTitle')}</h2>
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
      {available ? (
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
