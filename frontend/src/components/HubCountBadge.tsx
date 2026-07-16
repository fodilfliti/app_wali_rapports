type Props = {
  count: number
  className?: string
  /** `corner` = absolute on hub tiles; `inline` = next to section titles */
  variant?: 'corner' | 'inline'
}

export function HubCountBadge({ count, className = '', variant = 'corner' }: Props) {
  if (!count || count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={`hubCountBadge badge badge-submitted${
        variant === 'inline' ? ' hubCountBadge--inline' : ''
      }${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  )
}
