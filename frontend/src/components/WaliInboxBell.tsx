import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { HubCountBadge } from './HubCountBadge'
import { useWaliHubCounts } from '../hooks/useHubCounts'

type Props = { token: string }

export function WaliInboxBell({ token }: Props) {
  const { t } = useTranslation()
  const { counts } = useWaliHubCounts(token)
  const pending = counts.inbox_pending
  const label = pending > 0 ? `${t('navInbox')} (${pending > 99 ? '99+' : pending})` : t('navInbox')

  return (
    <Link
      className="btn btn-ghost notifBell"
      to="/wali/rapports"
      title={label}
      aria-label={label}
    >
      <span className="notifBellIconWrap">
        <HubIcon name="inbox" className="notifBellIcon" />
        <HubCountBadge count={pending} className="notifCount" />
      </span>
      <span className="notifBellLabel">{t('navInbox')}</span>
    </Link>
  )
}
