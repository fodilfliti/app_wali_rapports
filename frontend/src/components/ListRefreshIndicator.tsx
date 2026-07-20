import { useTranslation } from 'react-i18next'

type Props = {
  show?: boolean
  className?: string
}

/** Subtle indicator while cached list data is being refreshed in the background. */
export function ListRefreshIndicator({ show, className }: Props) {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <p
      className={`muted listRefreshIndicator${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {t('updating')}
    </p>
  )
}
