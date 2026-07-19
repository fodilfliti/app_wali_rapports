import type { ReactNode } from 'react'
import { HubTile, type HubTileProps } from './HubTile'
import { RapportTypeHideActions } from './RapportTypeHideActions'
import type { RapportTypeNav } from '../utils/rapportNavigation'

type Props = HubTileProps & {
  rapportType?: RapportTypeNav | null
  canManageType?: boolean
  onHideType?: (typeId: number) => void | Promise<void>
  onRestoreType?: (typeId: number) => void | Promise<void>
  onDeleteType?: (typeId: number) => void | Promise<void>
  dimmed?: boolean
  badgeOverlay?: ReactNode
}

export function HubTileWithMenu({
  rapportType,
  canManageType,
  onHideType,
  onRestoreType,
  onDeleteType,
  dimmed,
  badgeOverlay,
  badge,
  ...tileProps
}: Props) {
  const showActions =
    canManageType &&
    rapportType &&
    onHideType &&
    onRestoreType &&
    (rapportType.hidden_at ||
      rapportType.content_kind !== 'fiche_lecture' ||
      Boolean(rapportType.can_delete && onDeleteType))

  const countBadge = badgeOverlay ?? badge

  return (
    <div
      className={`hubTileCard${dimmed ? ' hubTileCard--dimmed' : ''}${
        showActions ? ' hubTileCard--hasMenu' : ''
      }`}
    >
      {/* Badge lives on the card so it is not covered by the ⋯ menu */}
      <HubTile {...tileProps} className={`hubTileCardLink ${tileProps.className || ''}`.trim()} />
      {countBadge ? (
        <span
          className={`hubTileCardBadge${showActions ? ' hubTileCardBadge--start' : ''}`}
        >
          {countBadge}
        </span>
      ) : null}
      {showActions ? (
        <div
          className="hubTileCardMenu"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <RapportTypeHideActions
            rapportType={rapportType}
            canManage={canManageType}
            onHideType={onHideType}
            onRestoreType={onRestoreType}
            onDeleteType={onDeleteType}
            variant="hub"
          />
        </div>
      ) : null}
    </div>
  )
}
