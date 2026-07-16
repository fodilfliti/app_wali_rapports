import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = {
  onSuccess: (res: api.LoginResponse) => void
  lang: 'ar' | 'fr'
  onToggleLang: () => void
}

const ROLES = [
  {
    key: 'office',
    labelKey: 'guestFeatureOfficeLabel',
    descKey: 'guestFeatureOfficeDesc',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16v12H4V7z" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    key: 'chef',
    labelKey: 'guestFeatureChefLabel',
    descKey: 'guestFeatureChefDesc',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 3l7 4v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" fill="none" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    key: 'wali',
    labelKey: 'guestFeatureWaliLabel',
    descKey: 'guestFeatureWaliDesc',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 12l7-4M12 12v9M12 12L5 8" fill="none" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
] as const

export function GuestLoginPage({ onSuccess, lang, onToggleLang }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [username, setUsername] = useState(() => localStorage.getItem('last_username') || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password.trim()) {
      setError(t('loginFieldsRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await api.login(username.trim(), password.trim())
      localStorage.setItem('last_username', username.trim())
      onSuccess(res)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(t('errorLoginFailed'))
        snack.show(t('errorLoginFailed'), 'error')
      } else {
        setError(t('errorLoginNetwork'))
        snack.show(t('errorLoginNetwork'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="guestPage">
      <section className="guestBrand" aria-label={t('guestWelcomeTitle')}>
        <div className="guestBrandInner">
          <div className="guestHeroBadge">{t('appTitle')}</div>
          <h1 className="guestHeroTitle">{t('guestWelcomeTitle')}</h1>
          <p className="guestHeroSubtitle">{t('guestWelcomeSubtitle')}</p>
          <ul className="guestRoles">
            {ROLES.map((role) => (
              <li key={role.key} className="guestRoleItem">
                <span className="guestRoleIcon">{role.icon}</span>
                <span className="guestRoleText">
                  <strong>{t(role.labelKey)}</strong>
                  <span>{t(role.descKey)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="guestAuth" aria-label={t('login')}>
        <div className="guestAuthCard">
          <div className="guestAuthHeader">
            <div>
              <h2>{t('login')}</h2>
              <p className="guestLoginHint">{t('loginHint')}</p>
            </div>
            <button type="button" className="guestLangBtn" onClick={onToggleLang}>
              {lang === 'ar' ? t('langFrench') : t('langArabic')}
            </button>
          </div>

          {error ? <div className="loginError" role="alert">{error}</div> : null}

          <form className="guestLoginForm" onSubmit={handleSubmit}>
            <label className="guestField">
              <span>{t('username')}</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder={t('username')}
              />
            </label>
            <label className="guestField">
              <span>{t('password')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('password')}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg guestLoginBtn" disabled={loading}>
              {loading ? '…' : t('signIn')}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
