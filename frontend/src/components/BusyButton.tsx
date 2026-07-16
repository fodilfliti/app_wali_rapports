import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean
  /** Shown instead of children while busy (defaults to t('loading')) */
  busyLabel?: ReactNode
}

/** Button that disables and swaps label while an async action runs. */
export function BusyButton({
  busy = false,
  busyLabel,
  disabled,
  children,
  type = 'button',
  className,
  ...rest
}: Props) {
  const { t } = useTranslation()
  return (
    <button
      type={type}
      className={className}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? busyLabel ?? t('loading') : children}
    </button>
  )
}
