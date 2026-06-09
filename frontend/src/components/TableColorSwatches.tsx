import { useTranslation } from 'react-i18next'
import { TABLE_COLOR_PRESETS, type TableColorKey } from '../utils/tableCellColors'

type Props = {
  value: TableColorKey | string | null | undefined
  onChange: (color: TableColorKey) => void
  compact?: boolean
  showCustom?: boolean
}

export function TableColorSwatches({ value, onChange, compact, showCustom }: Props) {
  const { t } = useTranslation()
  const current = (value as string) || 'none'

  return (
    <div className={`tableColorSwatches${compact ? ' tableColorSwatchesCompact' : ''}`}>
      {TABLE_COLOR_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className={`tableColorSwatch${current === preset.key ? ' active' : ''}${preset.key === 'none' ? ' tableColorSwatchClear' : ''}`}
          style={
            preset.key === 'none'
              ? undefined
              : { backgroundColor: preset.bg, borderColor: preset.border }
          }
          title={preset.key === 'none' ? t('tableCellColorClear') : preset.key}
          aria-label={preset.key === 'none' ? t('tableCellColorClear') : preset.key}
          onClick={() => onChange(preset.key)}
        />
      ))}
      {showCustom ? (
        <label className="tableColorSwatchCustom" title={t('richTextColorCustom')}>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#fde8e8'}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      ) : null}
    </div>
  )
}

export function TableCellColorToolbar({
  activeColor,
  onActiveColorChange,
}: {
  activeColor: TableColorKey
  onActiveColorChange: (color: TableColorKey) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="tableCellColorToolbar">
      <div className="tableCellColorToolbarHead">
        <strong>{t('tableCellColorTitle')}</strong>
        <span className="muted small tableCellColorHint">{t('tableCellColorHint')}</span>
      </div>
      <TableColorSwatches value={activeColor} onChange={onActiveColorChange} showCustom />
    </div>
  )
}
