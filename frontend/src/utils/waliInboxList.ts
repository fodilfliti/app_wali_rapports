import { rapportStatusLabel, waliResponseLabel } from './officeRapportList'

export function waliInboxRowClass(r: { status?: string; is_inbox_new?: boolean }) {
  const parts: string[] = ['waliInboxRow']
  if (r.is_inbox_new) {
    parts.push('waliInboxRowNew', 'rapportRowAttention', 'rapportRowUnread')
  } else if (r.status === 'submitted') {
    parts.push('waliInboxRowPending')
  }
  if (r.status) parts.push(`waliInboxRowStatus-${r.status}`)
  return parts.join(' ')
}

export function waliCanRespondFromList(status?: string) {
  return status === 'submitted' || status === 'under_review'
}

export { rapportStatusLabel, waliResponseLabel }
