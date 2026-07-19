import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionsMenuButton } from './ActionsMenuButton'
import { ConfirmActionModal } from './ConfirmActionModal'
import { localizedRapportTypeName, type RapportTypeNav } from '../utils/rapportNavigation'

type PendingAction = 'hide' | 'restore' | 'delete'

type Props = {
  rapportType: RapportTypeNav | null | undefined
  canManage?: boolean
  onHideType: (typeId: number) => void | Promise<void>
  onRestoreType: (typeId: number) => void | Promise<void>
  onDeleteType?: (typeId: number) => void | Promise<void>
  variant?: 'hub' | 'page'
}

export function RapportTypeHideActions({
  rapportType,
  canManage,
  onHideType,
  onRestoreType,
  onDeleteType,
  variant = 'page',
}: Props) {
  const { t, i18n } = useTranslation()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [loading, setLoading] = useState(false)

  if (!canManage || !rapportType) return null

  const typeName = localizedRapportTypeName(rapportType, i18n.language)
  const isHidden = Boolean(rapportType.hidden_at)
  const canHideType = rapportType.content_kind !== 'fiche_lecture'
  const canDelete = Boolean(rapportType.can_delete && onDeleteType && canHideType)

  const items = isHidden
    ? [{ key: 'restore', label: t('restoreRapportType'), onClick: () => setPending('restore') }]
    : [
        ...(canDelete
          ? [
              {
                key: 'delete',
                label: t('deleteUnusedRapportType'),
                onClick: () => setPending('delete' as const),
                danger: true,
              },
            ]
          : []),
        ...(canHideType
          ? [
              {
                key: 'hide',
                label: t('hideRapportType'),
                onClick: () => setPending('hide' as const),
                danger: !canDelete,
              },
            ]
          : []),
      ]

  if (!items.length) return null

  async function confirm() {
    if (!rapportType || !pending) return
    setLoading(true)
    try {
      if (pending === 'hide') await onHideType(rapportType.id)
      else if (pending === 'restore') await onRestoreType(rapportType.id)
      else if (pending === 'delete' && onDeleteType) await onDeleteType(rapportType.id)
      setPending(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ActionsMenuButton
        items={items}
        portal={variant === 'hub'}
        className={variant === 'hub' ? 'hubTileActionsMenu' : 'pageActionsMenu'}
        buttonClassName={variant === 'hub' ? 'hubTileMenuBtn' : 'pageActionsMenuBtn'}
        menuClassName={variant === 'hub' ? 'hubTileMenu' : 'pageActionsMenuDropdown'}
      />
      <ConfirmActionModal
        open={pending === 'hide'}
        title={t('hideRapportTypeConfirmTitle')}
        message={t('hideRapportTypeConfirmMessage', { name: typeName })}
        confirmLabel={t('hideRapportType')}
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
      <ConfirmActionModal
        open={pending === 'restore'}
        title={t('restoreRapportTypeConfirmTitle')}
        message={t('restoreRapportTypeConfirmMessage', { name: typeName })}
        confirmLabel={t('restoreRapportType')}
        loading={loading}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
      <ConfirmActionModal
        open={pending === 'delete'}
        title={t('deleteUnusedRapportTypeConfirmTitle')}
        message={t('deleteUnusedRapportTypeConfirmMessage', { name: typeName })}
        confirmLabel={t('deleteUnusedRapportType')}
        variant="danger"
        loading={loading}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </>
  )
}
