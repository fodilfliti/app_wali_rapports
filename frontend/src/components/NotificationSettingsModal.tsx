import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import {
  ensurePushSubscription,
  hasLocalPushSubscription,
  pushSupported,
  removePushSubscription,
  type PushEnsureStatus,
} from '../utils/webPush'

type PrefKey = keyof api.NotificationPreferences

type Props = {
  token: string
  open: boolean
  user: api.SessionUser
  onClose: () => void
}

const TYPE_KEYS: PrefKey[] = [
  'rapport_inbox',
  'rapport_feedback',
  'discussion',
  'instructions',
  'chef_instructions',
  'broadcasts',
  'calendar',
]

type SwitchCardProps = {
  title: string
  help?: string
  checked: boolean
  disabled?: boolean
  busy?: boolean
  variant?: 'default' | 'device'
  statusLabel?: string
  onToggle: (next: boolean) => void
}

function SwitchCard({
  title,
  help,
  checked,
  disabled,
  busy,
  variant = 'default',
  statusLabel,
  onToggle,
}: SwitchCardProps) {
  function activate() {
    if (disabled || busy) return
    onToggle(!checked)
  }

  return (
    <button
      type="button"
      className={[
        'notifSwitchCard',
        variant === 'device' ? 'notifSwitchCard--device' : '',
        checked ? 'notifSwitchCard--on' : '',
        disabled ? 'notifSwitchCard--disabled' : '',
        busy ? 'notifSwitchCard--busy' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || busy}
      disabled={disabled || busy}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
    >
      <span className="notifSwitchCardText">
        <span className="notifSwitchCardTitle">{title}</span>
        {help ? <span className="notifSwitchCardHelp">{help}</span> : null}
        {statusLabel ? (
          <span
            className={`notifStatusChip ${checked ? 'notifStatusChip--on' : 'notifStatusChip--off'}`}
          >
            {statusLabel}
          </span>
        ) : null}
      </span>
      <span className="notifSwitchTrack" aria-hidden>
        <span className="notifSwitchThumb" />
      </span>
    </button>
  )
}

type RecoveryDialogProps = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onRetry: () => void
}

function PushRecoveryDialog({ open, busy, onClose, onRetry }: RecoveryDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="modalOverlay" role="presentation" onClick={onClose}>
      <div
        className="modalCard confirmActionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifPushRecoveryTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="notifPushRecoveryTitle" className="confirmActionModalTitle">
          {t('notifPushRecoveryTitle')}
        </h2>
        <p className="muted confirmActionModalMessage">{t('notifPushRecoveryBody')}</p>
        <ol className="notifPushRecoverySteps">
          <li>{t('notifPushRecoveryStepsDesktop')}</li>
          <li>{t('notifPushRecoveryStepsAndroid')}</li>
        </ol>
        <div className="modalActions confirmActionModalActions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {t('notifPushRecoveryGotIt')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRetry}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? t('loading') : t('notifPushRecoveryRetry')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function NotificationSettingsModal({ token, open, user, onClose }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [prefs, setPrefs] = useState<api.NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [thisDeviceSubscribed, setThisDeviceSubscribed] = useState(false)
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  )
  const [needsBrowserReset, setNeedsBrowserReset] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  const showCalendar = user.role === 'WALI' || user.role === 'CHEF_CABINET'
  const showInstructions = user.role === 'OFFICE_USER'
  const showChefInstructions = user.role === 'OFFICE_USER' || user.role === 'WALI'
  const showBroadcasts =
    user.role === 'OFFICE_USER' || user.role === 'CHEF_CABINET' || user.role === 'WALI'
  const showInbox = user.role === 'WALI' || user.role === 'CHEF_CABINET'
  const showFeedback = user.role === 'OFFICE_USER'
  const supported = pushSupported()

  async function refreshThisDeviceState() {
    if (!supported) {
      setDevicePermission('unsupported')
      setThisDeviceSubscribed(false)
      return
    }
    if (typeof Notification !== 'undefined') setDevicePermission(Notification.permission)
    setThisDeviceSubscribed(await hasLocalPushSubscription())
  }

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setNeedsBrowserReset(false)
    setRecoveryOpen(false)
    void refreshThisDeviceState()
    api
      .getNotificationPreferences(token)
      .then((res) => setPrefs(res.preferences))
      .catch(() => snack.show(t('errorGeneric'), 'error'))
      .finally(() => setLoading(false))
  }, [open, token])

  if (!open) return null

  async function patch(
    partial: Partial<api.NotificationPreferences>,
    opts?: { silent?: boolean },
  ) {
    if (!prefs) return null
    const prev = prefs
    const next = { ...prefs, ...partial }
    setPrefs(next)
    setSaving(true)
    try {
      const res = await api.updateNotificationPreferences(token, partial)
      setPrefs(res.preferences)
      if (!opts?.silent) snack.show(t('notifPrefsSaved'), 'success')
      return res.preferences
    } catch {
      setPrefs(prev)
      snack.show(t('errorGeneric'), 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  function applyEnableResult(status: PushEnsureStatus) {
    if (typeof Notification !== 'undefined') setDevicePermission(Notification.permission)

    if (status === 'denied') {
      snack.show(t('notifPushDenied'), 'error')
      setDevicePermission('denied')
      setThisDeviceSubscribed(false)
      setNeedsBrowserReset(true)
      setRecoveryOpen(true)
      return
    }
    if (status === 'unsupported') {
      snack.show(t('notifPushUnsupported'), 'error')
      setDevicePermission('unsupported')
      setThisDeviceSubscribed(false)
      setNeedsBrowserReset(false)
      return
    }
    if (status === 'granted') {
      setThisDeviceSubscribed(true)
      setDevicePermission('granted')
      setNeedsBrowserReset(false)
      setRecoveryOpen(false)
      snack.show(t('notifPushThisEnabled'), 'success')
      return
    }
    if (status === 'needs_browser_reset') {
      setThisDeviceSubscribed(false)
      setNeedsBrowserReset(true)
      setRecoveryOpen(true)
      return
    }
    if (status === 'unavailable') {
      setThisDeviceSubscribed(false)
      snack.show(t('notifPushUnavailable'), 'error')
      return
    }
    // default (prompt dismissed)
    setThisDeviceSubscribed(false)
    snack.show(t('notifPushDenied'), 'error')
  }

  /** Account-wide push delivery (`push_enabled`). Off also unsubscribes this browser. */
  async function togglePushAllDevices(on: boolean) {
    setPushBusy(true)
    try {
      if (on) {
        await patch({ push_enabled: true }, { silent: true })
        snack.show(t('notifPushAllEnabled'), 'success')
      } else {
        await removePushSubscription(token)
        await refreshThisDeviceState()
        await patch({ push_enabled: false }, { silent: true })
        snack.show(t('notifPushAllDisabled'), 'success')
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPushBusy(false)
    }
  }

  /** Subscribe / unsubscribe this browser only — does not change other devices. */
  async function toggleThisDevice(on: boolean) {
    setPushBusy(true)
    try {
      if (on) {
        const { status } = await ensurePushSubscription(token)
        applyEnableResult(status)
      } else {
        await removePushSubscription(token)
        setThisDeviceSubscribed(false)
        setNeedsBrowserReset(false)
        snack.show(t('notifPushThisDisabled'), 'success')
      }
    } catch {
      snack.show(t('notifPushUnavailable'), 'error')
    } finally {
      setPushBusy(false)
    }
  }

  async function retryThisDeviceEnable() {
    setPushBusy(true)
    try {
      const { status } = await ensurePushSubscription(token)
      applyEnableResult(status)
    } catch {
      snack.show(t('notifPushUnavailable'), 'error')
    } finally {
      setPushBusy(false)
    }
  }

  function typeVisible(key: PrefKey) {
    if (key === 'calendar') return showCalendar
    if (key === 'instructions') return showInstructions
    if (key === 'chef_instructions') return showChefInstructions
    if (key === 'broadcasts') return showBroadcasts
    if (key === 'rapport_inbox') return showInbox
    if (key === 'rapport_feedback') return showFeedback
    return true
  }

  function allDevicesStatusLabel() {
    if (!supported || devicePermission === 'unsupported') return t('notifStatusUnsupported')
    if (prefs?.push_enabled && prefs.enabled) return t('notifStatusOn')
    return t('notifStatusOff')
  }

  function thisDeviceStatusLabel() {
    if (!supported || devicePermission === 'unsupported') return t('notifStatusUnsupported')
    if (devicePermission === 'denied' || needsBrowserReset) return t('notifStatusNeedsReset')
    if (prefs?.push_enabled && prefs.enabled && thisDeviceSubscribed && devicePermission === 'granted') {
      return t('notifStatusOn')
    }
    return t('notifStatusOff')
  }

  const masterOn = Boolean(prefs?.enabled)
  const pushAllOn = Boolean(prefs?.push_enabled && prefs?.enabled)
  const thisDeviceOn = Boolean(pushAllOn && thisDeviceSubscribed && devicePermission === 'granted')

  return (
    <div className="modalOverlay" role="dialog" aria-modal aria-labelledby="notif-settings-title">
      <div className="modalCard modalCardWide notifSettingsModal">
        <h2 id="notif-settings-title">{t('notifSettingsTitle')}</h2>
        <p className="notifSettingsLead">{t('notifSettingsHelp')}</p>

        {loading || !prefs ? (
          <p className="muted">{t('loading')}</p>
        ) : (
          <div className="notifSettingsBody">
            <section className="notifSettingsSection" aria-labelledby="notif-sec-inapp">
              <h3 id="notif-sec-inapp" className="notifSettingsSectionTitle">
                {t('notifSectionInApp')}
              </h3>
              <SwitchCard
                title={t('notifMaster')}
                help={t('notifMasterHelp')}
                checked={masterOn}
                disabled={saving}
                onToggle={(next) => patch({ enabled: next }, { silent: true })}
              />
              {!masterOn ? (
                <p className="notifSettingsBanner" role="status">
                  {t('notifAllStopped')}
                </p>
              ) : null}
            </section>

            <section
              className={`notifSettingsSection ${!masterOn ? 'notifSettingsSection--dimmed' : ''}`}
              aria-labelledby="notif-sec-device"
            >
              <h3 id="notif-sec-device" className="notifSettingsSectionTitle">
                {t('notifSectionDevice')}
              </h3>
              <div className="notifTypeCards">
                <SwitchCard
                  variant="device"
                  title={t('notifPushAll')}
                  help={t('notifPushAllHelp')}
                  checked={pushAllOn}
                  disabled={saving || !masterOn || !supported}
                  busy={pushBusy}
                  statusLabel={allDevicesStatusLabel()}
                  onToggle={(next) => togglePushAllDevices(next)}
                />
                <SwitchCard
                  variant="device"
                  title={t('notifPushThisDevice')}
                  help={t('notifPushThisDeviceHelp')}
                  checked={thisDeviceOn}
                  disabled={saving || !masterOn || !pushAllOn || !supported}
                  busy={pushBusy}
                  statusLabel={thisDeviceStatusLabel()}
                  onToggle={(next) => toggleThisDevice(next)}
                />
              </div>
            </section>

            <section
              className={`notifSettingsSection ${!masterOn ? 'notifSettingsSection--dimmed' : ''}`}
              aria-labelledby="notif-sec-types"
            >
              <h3 id="notif-sec-types" className="notifSettingsSectionTitle">
                {t('notifSectionTypes')}
              </h3>
              <div className="notifTypeCards">
                {TYPE_KEYS.filter(typeVisible).map((key) => (
                  <SwitchCard
                    key={key}
                    title={t(`notifType_${key}`)}
                    help={t(`notifTypeDesc_${key}`)}
                    checked={masterOn && prefs[key]}
                    disabled={saving || !masterOn}
                    onToggle={(next) => patch({ [key]: next }, { silent: true })}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        <div className="modalActions">
          <button type="button" className="btn" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>

      <PushRecoveryDialog
        open={recoveryOpen}
        busy={pushBusy}
        onClose={() => setRecoveryOpen(false)}
        onRetry={() => void retryThisDeviceEnable()}
      />
    </div>
  )
}
