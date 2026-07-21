import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmActionModal } from './ConfirmActionModal'

export type OfficeDeleteMode = 'instant' | 'request'

type Props = {
  mode: OfficeDeleteMode
  discardDraftVersion?: boolean
  resetFreshV1?: boolean
  onConfirm: () => void | Promise<void>
  children: (openConfirm: () => void) => ReactNode
}

export function DeleteRapportConfirm({
  mode,
  discardDraftVersion = false,
  resetFreshV1 = false,
  onConfirm,
  children,
}: Props) {
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

  const isRequest = mode === 'request'
  const title = isRequest
    ? t('deleteRapportRequestConfirmTitle')
    : discardDraftVersion
      ? t('deleteRapportDiscardVersionConfirmTitle')
      : resetFreshV1
        ? t('deleteRapportResetV1ConfirmTitle')
        : t('deleteRapportInstantConfirmTitle')
  const message = isRequest
    ? t('deleteRapportRequestConfirmMessage')
    : discardDraftVersion
      ? t('deleteRapportDiscardVersionConfirmMessage')
      : resetFreshV1
        ? t('deleteRapportResetV1ConfirmMessage')
        : t('deleteRapportInstantConfirmMessage')
  const confirmLabel = isRequest
    ? t('deleteRapportSendRequest')
    : t('deleteRapportConfirm')

  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmActionModal
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

type CancelProps = {
  onConfirm: () => void | Promise<void>
  children: (openConfirm: () => void) => ReactNode
}

export function CancelDeleteRequestConfirm({ onConfirm, children }: CancelProps) {
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
        title={t('cancelDeleteRequestConfirmTitle')}
        message={t('cancelDeleteRequestConfirmMessage')}
        confirmLabel={t('cancelDeleteRequest')}
        loading={loading}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

type ChefProps = {
  decision: 'approved' | 'rejected'
  onConfirm: () => void | Promise<void>
  children: (openConfirm: () => void) => ReactNode
}

export function ChefDeleteDecisionConfirm({
  decision,
  onConfirm,
  children,
}: ChefProps) {
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

  const approve = decision === 'approved'

  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmActionModal
        open={open}
        title={
          approve
            ? t('chefApproveDeleteConfirmTitle')
            : t('chefRejectDeleteConfirmTitle')
        }
        message={
          approve
            ? t('chefApproveDeleteConfirmMessage')
            : t('chefRejectDeleteConfirmMessage')
        }
        confirmLabel={
          approve ? t('chefApproveDelete') : t('chefRejectDelete')
        }
        variant={approve ? 'danger' : undefined}
        loading={loading}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
