import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { TablePagination } from './TablePagination'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'
import {
  broadcastFileExtension,
  broadcastFileKindClass,
  formatBroadcastFileSize,
  userInitials,
} from '../utils/broadcastUi'

type BroadcastFile = {
  original_name?: string
  mime_type?: string
  size_bytes?: number
}

export function BroadcastReadProgress({
  read,
  total,
}: {
  read?: number
  total?: number
}) {
  const { t } = useTranslation()
  const r = Number(read) || 0
  const tot = Number(total) || 0
  const pct = tot > 0 ? Math.round((r / tot) * 100) : 0

  return (
    <div className="broadcastReadProgress">
      <div className="broadcastReadProgressHead">
        <span className="broadcastReadProgressLabel">{t('broadcastReadProgress', { read: r, total: tot })}</span>
        <span className="broadcastReadProgressPct muted small">{pct}%</span>
      </div>
      <div className="broadcastReadProgressTrack" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="broadcastReadProgressFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function BroadcastFileCard({
  file,
  href,
  compact,
}: {
  file: BroadcastFile
  href: string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const name = file.original_name || t('shareFile')
  const ext = broadcastFileExtension(name)
  const size = formatBroadcastFileSize(file.size_bytes)
  const kindClass = broadcastFileKindClass(ext)

  return (
    <a
      className={`broadcastFileCard ${kindClass}${compact ? ' broadcastFileCard--compact' : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span className="broadcastFileCardIcon" aria-hidden="true">
        <span className="broadcastFileExtBadge">{ext}</span>
        <HubIcon name="file" className="broadcastFileCardIconSvg" />
      </span>
      <span className="broadcastFileCardBody">
        <span className="broadcastFileCardName" title={name}>
          {name}
        </span>
        {size ? <span className="broadcastFileCardMeta muted small">{size}</span> : null}
      </span>
      <span className="broadcastFileCardAction btn btn-secondary btn-sm">{t('broadcastOpenFile')}</span>
    </a>
  )
}

export function BroadcastRecipientRow({
  name,
  username,
  readAt,
}: {
  name?: string | null
  username?: string | null
  readAt?: string | null
}) {
  const { t, i18n } = useTranslation()
  const displayName = name || username || '—'
  const isRead = Boolean(readAt)

  return (
    <li className={`broadcastRecipientRow${isRead ? ' broadcastRecipientRow--read' : ' broadcastRecipientRow--unread'}`}>
      <span className="broadcastRecipientAvatar" aria-hidden="true">
        {userInitials(name, username)}
      </span>
      <span className="broadcastRecipientMain">
        <strong className="broadcastRecipientName">{displayName}</strong>
        {name && username ? <span className="muted small broadcastRecipientUsername">{username}</span> : null}
      </span>
      <span className="broadcastRecipientStatus">
        {isRead ? (
          <span className="broadcastRecipientReadAt muted small">
            {t('broadcastViewedAt', {
              date: new Date(readAt!).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ'),
            })}
          </span>
        ) : (
          <span className="badge badge-submitted">{t('unread')}</span>
        )}
      </span>
    </li>
  )
}

export function BroadcastRecipientsPanel({
  recipients,
  pagedRecipients,
  recipientPage,
  total,
  onPageChange,
}: {
  recipients: any[]
  pagedRecipients: any[]
  recipientPage: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const readCount = recipients.filter((r) => r.read_at).length
  const unreadCount = recipients.length - readCount

  return (
    <div className="broadcastDetailSection broadcastRecipientsSection">
      <div className="broadcastSectionHead">
        <h3>{t('whoViewed')}</h3>
        {recipients.length ? (
          <div className="broadcastRecipientSummary">
            <span className="broadcastRecipientSummaryItem broadcastRecipientSummaryItem--read">
              {t('broadcastRecipientsRead', { count: readCount })}
            </span>
            {unreadCount > 0 ? (
              <span className="broadcastRecipientSummaryItem broadcastRecipientSummaryItem--unread">
                {t('broadcastRecipientsUnread', { count: unreadCount })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {recipients.length ? (
        <ul className="broadcastRecipientsList">
          {pagedRecipients.map((r: any) => (
            <BroadcastRecipientRow
              key={r.user.id}
              name={r.user.name}
              username={r.user.username}
              readAt={r.read_at}
            />
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('noResults')}</p>
      )}
      {total > DEFAULT_PAGE_SIZE ? (
        <TablePagination page={recipientPage} total={total} onPageChange={onPageChange} compact />
      ) : null}
    </div>
  )
}

export function SharedUploaderTag({
  role,
  className,
}: {
  role?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  if (role !== 'WALI' && role !== 'CHEF_CABINET') return null
  const label = role === 'CHEF_CABINET' ? t('roleChefCabinet') : t('roleWali')
  const kind = role === 'CHEF_CABINET' ? 'chef' : 'wali'
  return (
    <span className={`sharedUploaderTag sharedUploaderTag--${kind}${className ? ` ${className}` : ''}`}>
      {label}
    </span>
  )
}

export function SharedBroadcastListCard({
  to,
  title,
  message,
  file,
  createdAt,
  readAt,
  stats,
  showUnreadBadge,
  createdByRole,
}: {
  to: string
  title: string
  message?: string
  file?: BroadcastFile | null
  createdAt?: string | null
  readAt?: string | null
  stats?: { read?: number; total?: number }
  showUnreadBadge?: boolean
  createdByRole?: string | null
}) {
  const { t, i18n } = useTranslation()
  const isUnread = showUnreadBadge ? !readAt : false
  const ext = file?.original_name ? broadcastFileExtension(file.original_name) : null
  const size = file?.size_bytes ? formatBroadcastFileSize(file.size_bytes) : ''
  const kindClass = ext ? broadcastFileKindClass(ext) : 'broadcastFileKind--file'

  return (
    <Link to={to} className={`sharedFileCard${isUnread ? ' sharedFileCard--unread' : ''}`}>
      <div className={`sharedFileCardFilePreview ${kindClass}`}>
        {ext ? <span className="sharedFileCardExt">{ext}</span> : <HubIcon name="shared" className="sharedFileCardFallbackIcon" />}
      </div>
      <div className="sharedFileCardContent">
        <div className="sharedFileCardTitleRow">
          <h2 className="sharedFileCardTitle">{title}</h2>
          {isUnread ? <span className="badge badge-submitted">{t('unread')}</span> : null}
        </div>
        <div className="sharedFileCardTags">
          <SharedUploaderTag role={createdByRole} />
        </div>
        {message ? <p className="sharedFileCardMessage muted">{message}</p> : null}
        {file?.original_name ? (
          <p className="sharedFileCardFileName muted small" title={file.original_name}>
            {file.original_name}
            {size ? ` · ${size}` : ''}
          </p>
        ) : null}
        <div className="sharedFileCardFooter">
          {stats?.total != null ? (
            <span className="sharedFileCardStat muted small">
              {t('broadcastReadProgress', { read: stats.read ?? 0, total: stats.total })}
            </span>
          ) : null}
          {createdAt ? (
            <time className="sharedFileCardDate muted small" dateTime={createdAt}>
              {new Date(createdAt).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ')}
            </time>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export function BroadcastCommentBlock({
  author,
  body,
}: {
  author?: string | null
  body?: string | null
}) {
  return (
    <li className="broadcastCommentBlock">
      <div className="broadcastCommentBlockHead">
        <span className="broadcastCommentAvatar" aria-hidden="true">
          {userInitials(author, null)}
        </span>
        <strong>{author || '—'}</strong>
      </div>
      <p className="broadcastCommentBody">{body}</p>
    </li>
  )
}
