import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { FieldErrorText } from './FieldErrorText'
import { FormErrorBlock } from './FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { userPatchFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'

type Props = {
  token: string
  open: boolean
  user: api.SessionUser
  onClose: () => void
  onSaved: (user: api.SessionUser) => void
}

export function EditProfileModal({ token, open, user, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(userPatchFormSchema)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(user.name || '')
    setJobTitle(user.job_title || '')
    form.clearErrors()
  }, [open, user.id, user.name, user.job_title])

  if (!open) return null

  function close() {
    form.clearErrors()
    onClose()
  }

  async function save() {
    const payload = { name, job_title: jobTitle }
    if (!form.validate(payload, t, ['name', 'job_title'])) return
    setSaving(true)
    try {
      const job = jobTitle.trim()
      const res = await api.patchMyProfile(token, {
        name: name.trim(),
        job_title: job || null,
      })
      snack.show(t('profileUpdated'), 'success')
      onSaved(res.user)
      close()
    } catch (e) {
      if (e instanceof api.ApiError && e.fieldErrors) form.setFieldErrorsFromApi(e.fieldErrors)
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalOverlay" role="dialog" aria-modal>
      <div className="modalCard">
        <h2>{t('editProfile')}</h2>
        <p className="muted small">{user.username}</p>
        <label>
          {t('userName')}
          <input
            id="profile-name"
            className={form.hasFieldError('name') ? 'inputInvalid' : ''}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <FieldErrorText text={form.fieldErrorText('name', t)} />
        </label>
        <label>
          {t('jobTitle')}
          <input
            id="profile-job_title"
            className={form.hasFieldError('job_title') ? 'inputInvalid' : ''}
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            autoComplete="organization-title"
          />
          <FieldErrorText text={form.fieldErrorText('job_title', t)} />
        </label>
        <FormErrorBlock message={form.formError} />
        <div className="modalActions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '…' : t('save')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
