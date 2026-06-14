import type { ReactNode } from 'react'
import { HubTile, type HubTileProps } from './HubTile'
import { RapportTypeHideActions } from './RapportTypeHideActions'
import type { RapportTypeNav } from '../utils/rapportNavigation'

type Props = HubTileProps & {
  rapportType?: RapportTypeNav | null
  canManageType?: boolean
  onHideType?: (typeId: number) => void | Promise<void>
  onRestoreType?: (typeId: number) => void | Promise<void>
  dimmed?: boolean
  badgeOverlay?: ReactNode
}

export function HubTileWithMenu({
  rapportType,
  canManageType,
  onHideType,
  onRestoreType,
  dimmed,
  badgeOverlay,
  ...tileProps
}: Props) {
  const showActions =
    canManageType &&
    rapportType &&
    onHideType &&
    onRestoreType &&
    (rapportType.hidden_at || rapportType.content_kind !== 'fiche_lecture')

  return (
    <div className={`hubTileCard${dimmed ? ' hubTileCard--dimmed' : ''}${showActions ? ' hubTileCard--hasMenu' : ''}`}>
      <HubTile {...tileProps} className={`hubTileCardLink ${tileProps.className || ''}`.trim()} />
      {badgeOverlay}
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
            variant="hub"
          />
        </div>
      ) : null}
    </div>
  )
}
