import { useTranslation } from 'react-i18next'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  loading,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="modalOverlay" role="presentation" onClick={onClose}>
      <div
        className="modalCard confirmActionModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmActionTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirmActionTitle" className="confirmActionModalTitle">
          {title}
        </h2>
        <p className="muted confirmActionModalMessage">{message}</p>
        <div className="modalActions confirmActionModalActions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel || t('cancel')}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'btn btn-accent' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? t('loading') : confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
