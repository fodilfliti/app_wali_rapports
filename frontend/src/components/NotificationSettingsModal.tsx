import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { useSnackbar } from '../snackbar/SnackbarContext'
import {
  ensurePushSubscription,
  hasLocalPushSubscription,
  pushSupported,
  removePushSubscription,
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

  const showCalendar = user.role === 'WALI' || user.role === 'CHEF_CABINET'
  const showInstructions = user.role === 'OFFICE_USER'
  const showBroadcasts = user.role === 'OFFICE_USER' || user.role === 'CHEF_CABINET'
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
        const result = await ensurePushSubscription(token)
        if (typeof Notification !== 'undefined') setDevicePermission(Notification.permission)
        if (result === 'denied') {
          snack.show(t('notifPushDenied'), 'error')
          setDevicePermission('denied')
          setThisDeviceSubscribed(false)
        } else if (result === 'unsupported') {
          snack.show(t('notifPushUnsupported'), 'error')
          setDevicePermission('unsupported')
          setThisDeviceSubscribed(false)
        } else if (result === 'granted') {
          setThisDeviceSubscribed(true)
          setDevicePermission('granted')
          snack.show(t('notifPushThisEnabled'), 'success')
        } else {
          setThisDeviceSubscribed(false)
          snack.show(t('notifPushDenied'), 'error')
        }
      } else {
        await removePushSubscription(token)
        setThisDeviceSubscribed(false)
        snack.show(t('notifPushThisDisabled'), 'success')
      }
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setPushBusy(false)
    }
  }

  function typeVisible(key: PrefKey) {
    if (key === 'calendar') return showCalendar
    if (key === 'instructions') return showInstructions
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
    if (devicePermission === 'denied') return t('notifStatusDenied')
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
    </div>
  )
}
