import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { useChefHubCounts } from '../hooks/useHubCounts'

type Props = { token: string }

export function ChefInboxBell({ token }: Props) {
  const { t } = useTranslation()
  const { counts } = useChefHubCounts(token)
  const pending = counts.inbox_pending
  const deletePending = counts.delete_pending || 0
  const discussion = counts.unread_discussion || 0
  const actionTotal = pending + deletePending
  const countLabel = actionTotal > 99 ? '99+' : String(actionTotal)
  const discLabel = discussion > 99 ? '99+' : String(discussion)
  const inboxTo =
    deletePending > 0 && pending === 0
      ? '/chef/rapports?status_group=delete_requested'
      : '/chef/rapports'
  const label =
    actionTotal > 0
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
        to={inboxTo}
        title={label}
        aria-label={label}
      >
        <span className="notifBellIconWrap">
          <HubIcon name="inbox" className="notifBellIcon" />
          {actionTotal > 0 ? (
            <span className="notifBellCount" aria-hidden="true">
              {countLabel}
            </span>
          ) : null}
        </span>
        <span className="notifBellLabel">{t('navInbox')}</span>
      </Link>
      <Link
        className="btn btn-ghost notifBell"
        to="/chef/rapports?view=discussion"
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
