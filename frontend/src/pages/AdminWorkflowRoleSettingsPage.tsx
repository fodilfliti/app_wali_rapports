import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CREATOR_ROLES } from '@wali/access-policy'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = { token: string }

function roleLabel(role: string, t: (k: string) => string) {
  if (role === 'OFFICE_USER') return t('roleOffice')
  if (role === 'PRESIDENT_DAIRA') return t('rolePresidentDaira')
  if (role === 'PRESIDENT_COMMUNE') return t('rolePresidentCommune')
  if (role === 'DIRECTEUR_DIRECTION') return t('roleDirecteurDirection')
  return role
}

export function AdminWorkflowRoleSettingsPage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [settings, setSettings] = useState<api.WorkflowRoleSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getWorkflowRoleSettings(token)
      .then((r) => {
        if (cancelled) return
        const byRole = Object.fromEntries((r.settings || []).map((s) => [s.role, s.chef_validate]))
        setSettings(
          CREATOR_ROLES.map((role) => ({
            role,
            chef_validate: byRole[role] !== false,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) snack.show(t('errorGeneric'), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, snack, t])

  function toggle(role: api.UserRole, enabled: boolean) {
    setSettings((prev) =>
      prev.map((s) => (s.role === role ? { ...s, chef_validate: enabled } : s)),
    )
  }

  async function save() {
    setSaving(true)
    try {
      const res = await api.patchWorkflowRoleSettings(
        token,
        settings.map((s) => ({ role: s.role, chef_validate: s.chef_validate })),
      )
      setSettings(res.settings || settings)
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navWorkflowRoleSettings')}</h1>
        <BusyButton
          type="button"
          className="btn btn-primary"
          onClick={save}
          busy={saving}
          busyLabel={t('saving')}
          disabled={loading}
        >
          {t('save')}
        </BusyButton>
        <BackButton fallbackTo="/" />
      </div>
      <p className="muted">{t('chefValidateHelp')}</p>
      <div className="card formStack">
        {loading ? <p className="muted">{t('loading')}</p> : null}
        {!loading
          ? settings.map((s) => (
              <label key={s.role} className="formCheck">
                <input
                  type="checkbox"
                  checked={s.chef_validate}
                  onChange={(e) => toggle(s.role, e.target.checked)}
                />
                <span>
                  {roleLabel(s.role, t)} — {t('chefValidateLabel')}
                </span>
              </label>
            ))
          : null}
      </div>
    </div>
  )
}
