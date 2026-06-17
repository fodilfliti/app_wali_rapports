import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Props = {
  className?: string
  /**
   * Explicit back target — use only to break loops (e.g. archive → editor).
   * Normal parent navigation should rely on history + fallbackTo.
   */
  to?: string
  fallbackTo?: string
  /** Replace history when using `to` (archive flows). Default false. */
  replace?: boolean
}

export function BackButton({
  className = 'btn btn-secondary',
  to,
  fallbackTo = '/',
  replace = false,
}: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (to) {
          navigate(to, { replace })
          return
        }

        if (window.history.length > 1) {
          navigate(-1)
          return
        }

        navigate(fallbackTo, { replace: true })
      }}
    >
      {t('back')}
    </button>
  )
}
