import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionsMenuButton } from './ActionsMenuButton'
import { ConfirmActionModal } from './ConfirmActionModal'
import { canFinishRapport } from '../utils/rapportNavigation'

type Props = {
  rapport: { id: number; title?: string; status: string; hidden_at?: string | null }
  canManage: boolean
  showHidden: boolean
  onHide: () => void | Promise<void>
  onRestore: () => void | Promise<void>
}

/** Office user soft-hide (kept in DB); shown as ⋮ menu item, not a hard delete. */
export function RapportRowHideActions({
  rapport,
  canManage,
  showHidden,
  onHide,
  onRestore,
}: Props) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<'hide' | null>(null)
  const [loading, setLoading] = useState(false)

  if (!canManage) return null

  const items = []
  if (!showHidden && canFinishRapport(rapport.status) && !rapport.hidden_at) {
    items.push({
      key: 'hide',
      label: t('hideRapportMenu'),
      danger: true,
      onClick: () => setPending('hide'),
    })
  }
  if (showHidden && rapport.hidden_at) {
    items.push({
      key: 'restore',
      label: t('restoreRapport'),
      onClick: () => void onRestore(),
    })
  }

  if (!items.length) return null

  async function confirmHide() {
    setLoading(true)
    try {
      await onHide()
      setPending(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ActionsMenuButton
        items={items}
        className="rapportRowActionsMenu"
        buttonClassName="btn btn-ghost btn-sm actionsMenuBtn--row"
        portal
      />
      <ConfirmActionModal
        open={pending === 'hide'}
        title={t('finishRapportConfirmTitle')}
        message={
          rapport.title
            ? t('finishRapportConfirmMessageNamed', { name: rapport.title })
            : t('finishRapportConfirmMessage')
        }
        confirmLabel={t('hideRapportMenu')}
        variant="danger"
        loading={loading}
        onConfirm={confirmHide}
        onClose={() => setPending(null)}
      />
    </>
  )
}
