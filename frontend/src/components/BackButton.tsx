import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Props = {
  className?: string
  fallbackTo?: string
}

export function BackButton({ className = 'btn btn-secondary', fallbackTo = '/' }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.history.length > 1) navigate(-1)
        else navigate(fallbackTo)
      }}
    >
      {t('back')}
    </button>
  )
}
