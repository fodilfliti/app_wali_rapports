import { useTranslation } from 'react-i18next'
import { ExpandableHelp } from './ExpandableHelp'
import {
  buildHeaderModel,
  colLabel,
  columnsHaveFooter,
  computeColumnFooter,
  computeRowSpanMap,
  formatCell,
  type Column,
  type LayoutJson,
  type TableMeta,
} from '../utils/tableLayout'

type Props = {
  columns: Column[]
  rows: Record<string, unknown>[]
  layoutJson?: LayoutJson | null
  tableMeta?: TableMeta
  editable?: boolean
  showRowMeta?: boolean
  onUpdateRow?: (idx: number, key: string, value: unknown) => void
  onTableMetaChange?: (patch: Partial<TableMeta>) => void
  onMergeToggle?: (colKey: string, checked: boolean) => void
}

export function TableTitleBlock({
  tableMeta,
  editable,
  onTableMetaChange,
}: Pick<Props, 'tableMeta' | 'editable' | 'onTableMetaChange'>) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const title = locale === 'fr' ? tableMeta?.title_fr : tableMeta?.title_ar
  const subtitle = locale === 'fr' ? tableMeta?.subtitle_fr : tableMeta?.subtitle_ar

  if (!editable && !title && !subtitle) return null

  if (!editable) {
    return (
      <div className="tableTitleBlock">
        {title ? <h2 className="tableTitle">{title}</h2> : null}
        {subtitle ? <p className="tableSubtitle">{subtitle}</p> : null}
      </div>
    )
  }

  return (
    <div className="tableTitleBlock tableTitleBlockEdit">
      <label>
        {t('tableTitle')}
        <input
          value={locale === 'fr' ? tableMeta?.title_fr ?? '' : tableMeta?.title_ar ?? ''}
          onChange={(e) =>
            onTableMetaChange?.(locale === 'fr' ? { title_fr: e.target.value } : { title_ar: e.target.value })
          }
        />
      </label>
      <label>
        {t('tableSubtitle')}
        <input
          value={locale === 'fr' ? tableMeta?.subtitle_fr ?? '' : tableMeta?.subtitle_ar ?? ''}
          onChange={(e) =>
            onTableMetaChange?.(
              locale === 'fr' ? { subtitle_fr: e.target.value } : { subtitle_ar: e.target.value },
            )
          }
        />
      </label>
    </div>
  )
}

export function TableMergeToolbar({
  columns,
  mergeKeys,
  editable,
  onMergeToggle,
}: {
  columns: Column[]
  mergeKeys: string[]
  editable?: boolean
  onMergeToggle?: (colKey: string, checked: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  if (!editable) return null
  const mergeable = columns.filter((c) => c.type !== 'formula')
  if (!mergeable.length) return null
  return (
    <div className="tableMergeToolbar">
      <strong>{t('mergeColumnsTitle')}</strong>
      <ExpandableHelp title={t('schemaHelpExpandMore')}>
        <p className="muted small">{t('mergeColumnsHelp')}</p>
        <p className="muted small">{t('mergeColumnsExample')}</p>
      </ExpandableHelp>
      <div className="tableMergeToolbarChecks">
        {mergeable.map((c) => (
          <label key={c.key} className="mergeCheck mergeCheckCard">
            <input
              type="checkbox"
              checked={mergeKeys.includes(c.key)}
              onChange={(e) => onMergeToggle?.(c.key, e.target.checked)}
            />
            <span className="mergeCheckBody">
              <code className="mergeCheckKey">{c.key}</code>
              <span>{colLabel(c, i18n.language)}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function TableGridView({
  columns,
  rows,
  layoutJson,
  tableMeta,
  editable = false,
  showRowMeta = false,
  onUpdateRow,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const mergeKeys = tableMeta?.merge_column_keys || []
  const header = buildHeaderModel(columns, layoutJson, locale)
  const spanMap = computeRowSpanMap(rows, mergeKeys)
  const displayCols = header.columnRow.length ? header.columnRow : columns.map((c) => ({ key: c.key, label: colLabel(c, locale) }))
  const showFooter = columnsHaveFooter(columns)
  let footerLabelPlaced = false

  return (
    <table>
      <thead>
        {header.hasGroupRow ? (
          <tr className="headerGroupRow">
            {showRowMeta ? <th rowSpan={2}>#</th> : null}
            {header.groupRow.map((g, i) => (
              <th key={i} colSpan={g.colSpan}>
                {g.label}
              </th>
            ))}
            {showRowMeta ? (
              <>
                <th rowSpan={2}>{t('waliVisible')}</th>
                <th rowSpan={2}>{t('highlight')}</th>
              </>
            ) : null}
          </tr>
        ) : null}
        <tr>
          {showRowMeta && !header.hasGroupRow ? <th>#</th> : null}
          {displayCols.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          {showRowMeta && !header.hasGroupRow ? (
            <>
              <th>{t('waliVisible')}</th>
              <th>{t('highlight')}</th>
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={idx}
            className={
              row._highlight === 'important'
                ? 'row-important'
                : row._highlight === 'warning'
                  ? 'row-warning'
                  : ''
            }
          >
            {showRowMeta ? <td>{idx + 1}</td> : null}
            {displayCols.map((dc) => {
              const col = columns.find((c) => c.key === dc.key)!
              const span = spanMap[dc.key]?.[idx]
              if (span === 0) return null
              const cellVal =
                col.type === 'commune_ref'
                  ? row._municipality_name_ar || row[col.key]
                  : row[col.key]
              return (
                <td key={dc.key} rowSpan={span && span > 1 ? span : undefined} className={span && span > 1 ? 'mergedCell' : ''}>
                  {col.type === 'formula' || col.type === 'commune_ref' ? (
                    <span>{col.type === 'commune_ref' ? String(cellVal ?? '') : formatCell(row[col.key], col, locale)}</span>
                  ) : editable && onUpdateRow && col.type === 'choice' ? (
                    <select
                      value={(row[col.key] as string) ?? ''}
                      onChange={(e) => onUpdateRow(idx, col.key, e.target.value)}
                    >
                      <option value="">—</option>
                      {(col.choices || []).map((ch) => (
                        <option key={ch.value} value={ch.value}>
                          {locale === 'fr' ? ch.label_fr : ch.label_ar}
                        </option>
                      ))}
                    </select>
                  ) : editable && onUpdateRow ? (
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={(row[col.key] as string | number) ?? ''}
                      onChange={(e) =>
                        onUpdateRow(idx, col.key, col.type === 'number' ? e.target.value : e.target.value)
                      }
                      disabled={col.type === 'formula'}
                    />
                  ) : (
                    formatCell(row[col.key], col, locale)
                  )}
                </td>
              )
            })}
            {showRowMeta ? (
              <>
                <td>
                  {editable && onUpdateRow ? (
                    <input
                      type="checkbox"
                      checked={row._wali_visible !== false}
                      onChange={(e) => onUpdateRow(idx, '_wali_visible', e.target.checked)}
                    />
                  ) : row._wali_visible !== false ? (
                    '✓'
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {editable && onUpdateRow ? (
                    <select
                      value={(row._highlight as string) || 'none'}
                      onChange={(e) => onUpdateRow(idx, '_highlight', e.target.value)}
                    >
                      <option value="none">—</option>
                      <option value="important">{t('highlightImportant')}</option>
                      <option value="warning">{t('highlightWarning')}</option>
                    </select>
                  ) : (
                    String(row._highlight ?? '')
                  )}
                </td>
              </>
            ) : null}
          </tr>
        ))}
      </tbody>
      {showFooter ? (
        <tfoot>
          <tr className="tableFooterRow">
            {showRowMeta ? <td className="tableFooterLabel" /> : null}
            {displayCols.map((dc) => {
              const col = columns.find((c) => c.key === dc.key)!
              const footerVal = computeColumnFooter(rows, col)
              if (footerVal != null) {
                return (
                  <td key={dc.key} className="tableFooterCell tableFooterValue">
                    {formatCell(footerVal, col, locale)}
                  </td>
                )
              }
              if (!footerLabelPlaced) {
                footerLabelPlaced = true
                return (
                  <td key={dc.key} className="tableFooterCell tableFooterLabel">
                    {t('tableFooterTotal')}
                  </td>
                )
              }
              return (
                <td key={dc.key} className="tableFooterCell">
                  —
                </td>
              )
            })}
            {showRowMeta ? (
              <>
                <td />
                <td />
              </>
            ) : null}
          </tr>
        </tfoot>
      ) : null}
    </table>
  )
}
