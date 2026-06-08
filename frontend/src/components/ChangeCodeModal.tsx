import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { FieldErrorText } from './FieldErrorText'
import { FormErrorBlock } from './FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { changeCodeSchema } from '../validation/schemas/changeCode'
import { useZodForm } from '../validation/useZodForm'

type Props = {
  token: string
  open: boolean
  onClose: () => void
}

export function ChangeCodeModal({ token, open, onClose }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(changeCodeSchema)
  const [currentCode, setCurrentCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function reset() {
    setCurrentCode('')
    setNextCode('')
    form.clearErrors()
    setSuccess(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function save() {
    const payload = { current_code: currentCode, new_code: nextCode }
    if (!form.validate(payload, t, ['current_code', 'new_code'])) return
    setSaving(true)
    try {
      await api.changePassword(token, {
        current_code: currentCode.trim(),
        new_code: nextCode.trim(),
      })
      reset()
      setSuccess(true)
    } catch (e) {
      const msg =
        e instanceof api.ApiError && e.message === 'errorCurrentCodeIncorrect'
          ? t('errorCurrentCodeIncorrect')
          : t('errorGeneric')
      snack.show(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalOverlay" role="dialog">
      <div className="modalCard">
        <h2>{success ? t('done') : t('changeCode')}</h2>
        {success ? (
          <>
            <p className="muted">{t('codeChangedSuccess')}</p>
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={close}>
                {t('close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">{t('changeCodeHint')}</p>
            <label>
              {t('currentCode')}
              <input
                type="password"
                className={form.hasFieldError('current_code') ? 'inputInvalid' : ''}
                value={currentCode}
                onChange={(e) => setCurrentCode(e.target.value)}
                autoComplete="current-password"
              />
              <FieldErrorText text={form.fieldErrorText('current_code', t)} />
            </label>
            <label>
              {t('newCode')}
              <input
                type="password"
                className={form.hasFieldError('new_code') ? 'inputInvalid' : ''}
                value={nextCode}
                onChange={(e) => setNextCode(e.target.value)}
                autoComplete="new-password"
              />
              <FieldErrorText text={form.fieldErrorText('new_code', t)} />
            </label>
            <FormErrorBlock message={form.formError} />
            <div className="modalActions">
              <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? '…' : t('save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
