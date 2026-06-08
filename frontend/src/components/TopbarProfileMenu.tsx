import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionUser } from '../api'

type Props = {
  user: SessionUser
  lang: 'ar' | 'fr'
  onSetLang: (lang: 'ar' | 'fr') => void
  onChangeCode: () => void
  onLogout: () => void
}

function SettingsIcon() {
  return (
    <svg className="topbarSettingsIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TopbarProfileMenu({ user, lang, onSetLang, onChangeCode, onLogout }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const displayName = (user.name && user.name.trim()) || user.username

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="topbarProfile" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost topbarProfileToggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('settings')}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon />
      </button>
      {open ? (
        <div className="topbarProfilePanel" role="menu">
          <div className="topbarProfileHeader">
            <div className="topbarProfileName">{displayName}</div>
            {user.job_title ? <div className="topbarProfileMeta">{user.job_title}</div> : null}
          </div>
          <button
            type="button"
            className="topbarProfileItem"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onChangeCode()
            }}
          >
            {t('changeCode')}
          </button>
          <div className="topbarProfileLang" role="group" aria-label={t('language')}>
            <span className="topbarProfileLangLabel">{t('language')}</span>
            <div className="topbarProfileLangSwitch">
              <button
                type="button"
                className={`topbarLangBtn ${lang === 'ar' ? 'active' : ''}`}
                onClick={() => onSetLang('ar')}
              >
                {t('langArabic')}
              </button>
              <button
                type="button"
                className={`topbarLangBtn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => onSetLang('fr')}
              >
                {t('langFrench')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="topbarProfileItem topbarProfileItemDanger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
