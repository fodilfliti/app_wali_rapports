import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmActionModal } from './ConfirmActionModal'

type Props = {
  rapportTitle?: string
  onConfirm: () => void | Promise<void>
  children: (openConfirm: () => void) => ReactNode
}

export function FinishRapportConfirm({ rapportTitle, onConfirm, children }: Props) {
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
        title={t('finishRapportConfirmTitle')}
        message={
          rapportTitle
            ? t('finishRapportConfirmMessageNamed', { name: rapportTitle })
            : t('finishRapportConfirmMessage')
        }
        confirmLabel={t('finishRapport')}
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
