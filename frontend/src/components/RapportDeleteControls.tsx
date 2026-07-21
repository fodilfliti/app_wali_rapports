import { useTranslation } from 'react-i18next'
import { BusyButton } from './BusyButton'
import {
  CancelDeleteRequestConfirm,
  ChefDeleteDecisionConfirm,
  DeleteRapportConfirm,
  type OfficeDeleteMode,
} from './DeleteRapportConfirm'
import { officeDeleteMode } from '../utils/rapportNavigation'

type OfficeProps = {
  rapport: any
  canManage: boolean
  deleting?: boolean
  cancelling?: boolean
  onDelete: () => void | Promise<void>
  onCancelRequest: () => void | Promise<void>
  size?: 'sm' | 'md'
}

export function OfficeRapportDeleteControls({
  rapport,
  canManage,
  deleting,
  cancelling,
  onDelete,
  onCancelRequest,
  size = 'sm',
}: OfficeProps) {
  const { t } = useTranslation()
  if (!canManage || !rapport) return null

  const btnClass = size === 'sm' ? 'btn btn-danger btn-sm' : 'btn btn-danger'
  const secondaryClass =
    size === 'sm' ? 'btn btn-secondary btn-sm' : 'btn btn-secondary'

  if (rapport.delete_requested || rapport.delete_requested_at) {
    return (
      <CancelDeleteRequestConfirm onConfirm={onCancelRequest}>
        {(openConfirm) => (
          <BusyButton
            type="button"
            className={secondaryClass}
            busy={!!cancelling}
            busyLabel={t('loading')}
            onClick={openConfirm}
          >
            {t('cancelDeleteRequest')}
          </BusyButton>
        )}
      </CancelDeleteRequestConfirm>
    )
  }

  const mode = officeDeleteMode(rapport) as OfficeDeleteMode | null
  if (!mode) return null

  return (
    <DeleteRapportConfirm
      mode={mode}
      discardDraftVersion={!!rapport.can_discard_draft_version}
      resetFreshV1={!!rapport.can_reset_fresh_v1}
      onConfirm={onDelete}
    >
      {(openConfirm) => (
        <BusyButton
          type="button"
          className={btnClass}
          busy={!!deleting}
          busyLabel={t('loading')}
          onClick={openConfirm}
        >
          {t('deleteRapport')}
        </BusyButton>
      )}
    </DeleteRapportConfirm>
  )
}

type ChefProps = {
  rapport: any
  deleting?: boolean
  onDecide: (decision: 'approved' | 'rejected') => void | Promise<void>
  size?: 'sm' | 'md'
}

export function ChefRapportDeleteControls({
  rapport,
  deleting,
  onDecide,
  size = 'sm',
}: ChefProps) {
  const { t } = useTranslation()
  if (!rapport?.delete_requested && !rapport?.delete_requested_at) return null

  const btnClass = size === 'sm' ? 'btn btn-sm' : 'btn'

  return (
    <>
      <ChefDeleteDecisionConfirm
        decision="approved"
        onConfirm={() => onDecide('approved')}
      >
        {(openConfirm) => (
          <BusyButton
            type="button"
            className={`${btnClass} btn-danger`}
            busy={!!deleting}
            busyLabel={t('loading')}
            onClick={openConfirm}
          >
            {t('chefApproveDelete')}
          </BusyButton>
        )}
      </ChefDeleteDecisionConfirm>
      <ChefDeleteDecisionConfirm
        decision="rejected"
        onConfirm={() => onDecide('rejected')}
      >
        {(openConfirm) => (
          <BusyButton
            type="button"
            className={`${btnClass} btn-secondary`}
            busy={!!deleting}
            busyLabel={t('loading')}
            onClick={openConfirm}
          >
            {t('chefRejectDelete')}
          </BusyButton>
        )}
      </ChefDeleteDecisionConfirm>
    </>
  )
}

/** Visible status card on Chef detail when office asked to delete. */
export function ChefDeleteRequestBanner({
  rapport,
  deleting,
  onDecide,
}: {
  rapport: any
  deleting?: boolean
  onDecide: (decision: 'approved' | 'rejected') => void | Promise<void>
}) {
  const { t } = useTranslation()
  if (!rapport?.delete_requested && !rapport?.delete_requested_at) return null

  return (
    <div
      className="card rapportOfficeStatusBanner rapportOfficeStatusBanner--deleteRequest"
      role="status"
    >
      <div className="rapportOfficeStatusBannerBody">
        <strong className="rapportOfficeStatusBannerTitle">
          {t('chefDeleteRequestBannerTitle')}
        </strong>
        <p className="muted small">{t('chefDeleteRequestBannerHint')}</p>
      </div>
      <div className="rapportOfficeStatusBannerActions">
        <ChefRapportDeleteControls
          rapport={rapport}
          deleting={deleting}
          onDecide={onDecide}
          size="md"
        />
      </div>
    </div>
  )
}
