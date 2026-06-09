const WALI_DECISION_I18N: Record<string, string> = {
  accepted: 'waliDecision_accepted',
  changes_requested: 'waliDecision_changes_requested',
  viewed: 'waliDecision_viewed',
}

const WALI_FOLLOW_UP_I18N: Record<string, string> = {
  none: 'waliFollowUp_noneShort',
  pending: 'waliFollowUp_pendingShort',
  completed: 'waliFollowUp_completedShort',
}

export function waliDecisionLabel(
  decision: string,
  t: (key: string) => string,
  followUpStatus?: string | null,
): string {
  const normalized = String(decision || '').trim()
  if (normalized === 'accepted') {
    const followUp = String(followUpStatus || 'none').trim()
    const followKey = WALI_FOLLOW_UP_I18N[followUp]
    if (followKey && followUp !== 'none') {
      return `${t(WALI_DECISION_I18N.accepted)} — ${t(followKey)}`
    }
  }
  const key = WALI_DECISION_I18N[normalized]
  return key ? t(key) : normalized
}
