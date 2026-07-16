import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BusyButton } from './BusyButton'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (res: api.LoginResponse) => void
}

export function LoginModal({ open, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.login(username, password)
      onSuccess(res)
      onClose()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modalOverlay" role="dialog">
      <div className="modalCard">
        <h2>{t('login')}</h2>
        <p className="muted">{t('loginHint')}</p>
        <form onSubmit={handleSubmit}>
          <label>
            {t('username')}
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label>
            {t('password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="modalActions">
            <BusyButton type="submit" className="btn btn-primary" busy={loading} busyLabel={t('loading')}>
              {t('signIn')}
            </BusyButton>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
