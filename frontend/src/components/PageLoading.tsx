import { useTranslation } from 'react-i18next'

type Props = {
  className?: string
}

/** Inline page/list fetch placeholder (muted text). */
export function PageLoading({ className }: Props) {
  const { t } = useTranslation()
  return (
    <p className={`muted pageLoading${className ? ` ${className}` : ''}`}>{t('loading')}</p>
  )
}
