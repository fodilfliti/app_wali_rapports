import * as api from '../api'
import { notifyHubCountsRefresh } from './hubCountsRefresh'
import { waliDecisionLabel } from './waliDecision'

export function rapportNeedsAttention(r: {
  status?: string
  has_unread_notification?: boolean
}) {
  return r.status === 'changes_requested' || r.has_unread_notification
}

export function waliCommentPreview(r: { latest_wali_response?: { body_text?: string | null } | null }) {
  const raw = r.latest_wali_response?.body_text
  const text = String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!text || text === '—') return null
  return text.length > 140 ? `${text.slice(0, 140)}…` : text
}

export function chefCommentPreview(r: { latest_chef_response?: { body_text?: string | null } | null }) {
  const raw = r.latest_chef_response?.body_text
  const text = String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
  if (!text || text === '—') return null
  return text.length > 140 ? `${text.slice(0, 140)}…` : text
}

export function rapportStatusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    draft: 'statusDraft',
    pending_chef: 'statusPendingChef',
    submitted: 'statusSubmitted',
    under_review: 'statusUnderReview',
    changes_requested: 'statusChangesRequested',
    acknowledged: 'statusAcknowledged',
  }
  return t(map[status] || 'statusDraft')
}

export async function markOfficeRapportOpened(token: string, rapportId: number) {
  try {
    await api.markRapportNotificationsRead(token, rapportId)
    await notifyHubCountsRefresh()
  } catch {
    /* ignore */
  }
}

export function patchRapportUnread<T extends { id: number; has_unread_notification?: boolean }>(
  rows: T[],
  rapportId: number,
): T[] {
  return rows.map((row) =>
    Number(row.id) === Number(rapportId) ? { ...row, has_unread_notification: false } : row,
  )
}

export function waliResponseLabel(
  r: { latest_wali_response?: { decision?: string; follow_up_status?: string | null } | null },
  t: (k: string) => string,
) {
  const wr = r.latest_wali_response
  if (!wr?.decision) return null
  return waliDecisionLabel(wr.decision, t, wr.follow_up_status)
}

export function chefResponseLabel(
  r: { latest_chef_response?: { decision?: string; follow_up_status?: string | null } | null },
  t: (k: string) => string,
) {
  const cr = r.latest_chef_response
  if (!cr?.decision) return null
  return waliDecisionLabel(cr.decision, t, cr.follow_up_status)
}
