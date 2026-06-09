type Props = {
  count: number
  className?: string
}

export function HubCountBadge({ count, className = '' }: Props) {
  if (!count || count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return <span className={`hubCountBadge badge badge-submitted${className ? ` ${className}` : ''}`}>{label}</span>
}
