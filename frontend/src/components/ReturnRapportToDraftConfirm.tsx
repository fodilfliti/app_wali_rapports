import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmActionModal } from './ConfirmActionModal'

type Props = {
  onConfirm: () => void | Promise<void>
  children: (openConfirm: () => void) => ReactNode
}

export function ReturnRapportToDraftConfirm({ onConfirm, children }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmActionModal
        open={open}
        title={t('returnToDraftConfirmTitle')}
        message={t('returnToDraftConfirmMessage')}
        confirmLabel={t('returnToDraft')}
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
