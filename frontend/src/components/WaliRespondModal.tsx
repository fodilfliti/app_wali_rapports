import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FieldErrorText } from './FieldErrorText'
import { FormErrorBlock } from './FormErrorBlock'
import { useZodForm } from '../validation/useZodForm'
import { waliRespondSchema } from '../validation/schemas/forms'

export type WaliFollowUpStatus = 'none' | 'pending' | 'completed'
export type WaliDecision = 'accepted' | 'changes_requested' | 'viewed'

export type WaliRespondPayload = {
  decision: WaliDecision
  follow_up_status?: WaliFollowUpStatus
  body_text?: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: WaliRespondPayload) => Promise<void>
}

export function WaliRespondModal({ open, onClose, onSubmit }: Props) {
  const { t } = useTranslation()
  const form = useZodForm(waliRespondSchema)
  const [decision, setDecision] = useState<WaliDecision>('accepted')
  const [followUpStatus, setFollowUpStatus] = useState<WaliFollowUpStatus>('none')
  const [bodyText, setBodyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDecision('accepted')
    setFollowUpStatus('none')
    setBodyText('')
    form.clearErrors()
  }, [open])

  const showFollowUp = decision === 'accepted'
  const showNote = decision === 'changes_requested' || decision === 'accepted'
  const noteRequired = decision === 'changes_requested'
  const noteOptionalHint = decision === 'accepted'

  const decisionHelp = useMemo(() => {
    if (decision === 'viewed') return t('waliDecisionHelp_viewed')
    if (decision === 'changes_requested') return t('waliDecisionHelp_changes_requested')
    return t('waliDecisionHelp_accepted')
  }, [decision, t])

  if (!open) return null

  async function handleSubmit() {
    const payload: WaliRespondPayload = {
      decision,
      body_text: showNote ? bodyText.trim() || undefined : undefined,
      follow_up_status: decision === 'accepted' ? followUpStatus : 'none',
    }
    if (!form.validate(payload, t, noteRequired ? ['body_text'] : [])) return
    setSubmitting(true)
    try {
      await onSubmit(payload)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalOverlay">
      <div className="modalCard waliRespondModal">
        <h2>{t('respondRapport')}</h2>
        <label>
          {t('waliDecision')}
          <select
            value={decision}
            onChange={(e) => {
              const next = e.target.value as WaliDecision
              setDecision(next)
              if (next !== 'accepted') setFollowUpStatus('none')
              if (next === 'viewed') setBodyText('')
              form.clearErrors()
            }}
          >
            <option value="accepted">{t('waliDecision_accepted')}</option>
            <option value="changes_requested">{t('waliDecision_changes_requested')}</option>
            <option value="viewed">{t('waliDecision_viewed')}</option>
          </select>
        </label>
        <p className="muted small waliDecisionHelp">{decisionHelp}</p>

        {showFollowUp ? (
          <fieldset className="waliFollowUpFieldset">
            <legend>{t('waliFollowUpLegend')}</legend>
            <div className="waliFollowUpOptions">
              <label
                className={`waliFollowUpOption${followUpStatus === 'none' ? ' waliFollowUpOption--selected' : ''}`}
              >
                <span className="waliFollowUpOptionRadio">
                  <input
                    type="radio"
                    name="follow_up_status"
                    checked={followUpStatus === 'none'}
                    onChange={() => setFollowUpStatus('none')}
                  />
                </span>
                <span className="waliFollowUpOptionText">
                  <strong>{t('waliFollowUp_none')}</strong>
                  <span className="muted small waliFollowUpOptionHint">{t('waliFollowUp_noneHint')}</span>
                </span>
              </label>
              <label
                className={`waliFollowUpOption${followUpStatus === 'pending' ? ' waliFollowUpOption--selected' : ''}`}
              >
                <span className="waliFollowUpOptionRadio">
                  <input
                    type="radio"
                    name="follow_up_status"
                    checked={followUpStatus === 'pending'}
                    onChange={() => setFollowUpStatus('pending')}
                  />
                </span>
                <span className="waliFollowUpOptionText">
                  <strong>{t('waliFollowUp_pending')}</strong>
                  <span className="muted small waliFollowUpOptionHint">{t('waliFollowUp_pendingHint')}</span>
                </span>
              </label>
              <label
                className={`waliFollowUpOption${followUpStatus === 'completed' ? ' waliFollowUpOption--selected' : ''}`}
              >
                <span className="waliFollowUpOptionRadio">
                  <input
                    type="radio"
                    name="follow_up_status"
                    checked={followUpStatus === 'completed'}
                    onChange={() => setFollowUpStatus('completed')}
                  />
                </span>
                <span className="waliFollowUpOptionText">
                  <strong>{t('waliFollowUp_completed')}</strong>
                  <span className="muted small waliFollowUpOptionHint">{t('waliFollowUp_completedHint')}</span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {showNote ? (
          <label>
            {noteRequired ? t('waliResponseText') : t('waliResponseOptional')}
            <textarea
              id="body_text"
              className={form.hasFieldError('body_text') ? 'inputInvalid' : ''}
              rows={5}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={noteOptionalHint ? t('waliResponseOptionalPlaceholder') : undefined}
            />
            <FieldErrorText text={form.fieldErrorText('body_text', t)} />
          </label>
        ) : null}

        <FormErrorBlock message={form.formError} />
        <div className="modalActions">
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {t('save')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function waliResponseBodyText(body: string | null | undefined) {
  const text = String(body || '').trim()
  if (!text || text === '—') return ''
  return text
}
