import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { HubIcon, type HubIconName } from './HubIcons'

type Props = {
  to?: string
  onClick?: () => void
  icon: HubIconName
  title: string
  subtitle?: string
  badge?: ReactNode
  className?: string
}

export function HubTile({ to, onClick, icon, title, subtitle, badge, className = '' }: Props) {
  const body = (
    <>
      <HubIcon name={icon} className="hubTileIcon" />
      <span className="hubTileTitle">{title}</span>
      {subtitle ? <span className="muted small hubTileSubtitle">{subtitle}</span> : null}
      {badge}
    </>
  )

  if (to) {
    return (
      <Link className={`hubTile ${className}`.trim()} to={to}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" className={`hubTile btnTile ${className}`.trim()} onClick={onClick}>
      {body}
    </button>
  )
}
