import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Props = {
  className?: string
  /**
   * Explicit structural parent — navigates with replace (never pushes over current page).
   * Prefer history + fallbackTo for normal “previous page” behavior.
   */
  to?: string
  fallbackTo?: string
  /**
   * When using `to`, whether to replace history. Defaults to true so Back never
   * stacks the parent under the current page (list ↔ view bounce).
   */
  replace?: boolean
}

function canGoBackInApp(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  if (typeof idx === 'number') return idx > 0
  return window.history.length > 1
}

export function BackButton({
  className = 'btn btn-secondary',
  to,
  fallbackTo = '/',
  replace = true,
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

        if (canGoBackInApp()) {
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
