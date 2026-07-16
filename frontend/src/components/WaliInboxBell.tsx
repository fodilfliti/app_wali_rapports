import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { useWaliHubCounts } from '../hooks/useHubCounts'

type Props = { token: string }

export function WaliInboxBell({ token }: Props) {
  const { t } = useTranslation()
  const { counts } = useWaliHubCounts(token)
  const pending = counts.inbox_pending
  const discussion = counts.unread_discussion || 0
  const countLabel = pending > 99 ? '99+' : String(pending)
  const discLabel = discussion > 99 ? '99+' : String(discussion)
  const label =
    pending > 0
      ? t('waliInboxBellWithCount', { count: countLabel })
      : t('waliInboxBellEmpty')
  const discAria =
    discussion > 0
      ? t('unreadDiscussionBellWithCount', { count: discLabel })
      : t('unreadDiscussionBell')

  return (
    <>
      <Link
        className="btn btn-ghost notifBell"
        to="/wali/rapports"
        title={label}
        aria-label={label}
      >
        <span className="notifBellIconWrap">
          <HubIcon name="inbox" className="notifBellIcon" />
          {pending > 0 ? (
            <span className="notifBellCount" aria-hidden="true">
              {countLabel}
            </span>
          ) : null}
        </span>
        <span className="notifBellLabel">{t('navInbox')}</span>
      </Link>
      <Link
        className="btn btn-ghost notifBell"
        to="/wali/rapports?view=discussion"
        title={discAria}
        aria-label={discAria}
      >
        <span className="notifBellIconWrap">
          <HubIcon name="notifications" className="notifBellIcon" />
          {discussion > 0 ? (
            <span className="notifBellCount notifBellCount--accent" aria-hidden="true">
              {discLabel}
            </span>
          ) : null}
        </span>
        <span className="notifBellLabel">{t('navDiscussion')}</span>
      </Link>
    </>
  )
}
