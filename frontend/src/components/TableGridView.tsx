import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { useTranslation } from 'react-i18next'

import { ExpandableHelp } from './ExpandableHelp'
import { TableCellColorToolbar } from './TableColorSwatches'

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

import { pickBilingualText } from '../utils/bilingual'

import {

  cellColorFor,

  tableColorBackground,

  type TableColorKey,

} from '../utils/tableCellColors'
import { filterTableRowEntries, type TableRowFilterMode } from '../utils/tableRowMeta'



type Props = {

  columns: Column[]

  rows: Record<string, unknown>[]

  layoutJson?: LayoutJson | null

  tableMeta?: TableMeta

  editable?: boolean

  showRowMeta?: boolean

  onUpdateRow?: (idx: number, key: string, value: unknown) => void

  onSetAllWaliVisible?: (visible: boolean) => void

  onUpdateCellColor?: (rowIdx: number, colKey: string, color: string | null) => void
  onDeleteRow?: (rowIdx: number) => void
  showFinishedRows?: boolean
  rowFilterMode?: TableRowFilterMode
  onTableMetaChange?: (patch: Partial<TableMeta>) => void

  onMergeToggle?: (colKey: string, checked: boolean) => void

  hideColorToolbar?: boolean
  activeCellColor?: TableColorKey
  onActiveCellColorChange?: (color: TableColorKey) => void

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



function TableRowDeleteButton({
  disabled,
  onClick,
  title,
}: {
  disabled?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      className="tableRowDeleteBtn"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
        />
      </svg>
    </button>
  )
}

function TableRowDeleteHeader({ title, rowSpan }: { title: string; rowSpan?: number }) {
  return (
    <th className="tableRowDeleteCol" title={title} aria-label={title} rowSpan={rowSpan}>
      <span className="tableRowDeleteHeaderIcon" aria-hidden>
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path
            fill="currentColor"
            d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
          />
        </svg>
      </span>
    </th>
  )
}

export function TableRowActions({
  editable,
  onAddRow,
  prominent = false,
}: {
  editable?: boolean
  rowCount?: number
  onAddRow?: () => void
  onRemoveLastRow?: () => void
  prominent?: boolean
}) {
  const { t } = useTranslation()
  if (!editable || !onAddRow) return null
  return (
    <div className="tableRowActions">
      <button
        type="button"
        className={`btn ${prominent ? 'btn-primary tableAddRowBtn' : 'btn-secondary'}`}
        onClick={onAddRow}
      >
        {prominent ? `+ ${t('addRow')}` : t('addRow')}
      </button>
    </div>
  )
}



export function TableRowFilterBar({
  filterMode,
  finishedCount,
  activeCount,
  totalCount,
  onFilterModeChange,
}: {
  filterMode: TableRowFilterMode
  finishedCount: number
  activeCount: number
  totalCount: number
  onFilterModeChange: (mode: TableRowFilterMode) => void
}) {
  const { t } = useTranslation()
  if (totalCount <= 0) return null

  const options: { mode: TableRowFilterMode; label: string; count: number; disabled?: boolean }[] = [
    { mode: 'active', label: t('tableRowFilterActive'), count: activeCount },
    {
      mode: 'finished',
      label: t('tableRowFilterFinished'),
      count: finishedCount,
      disabled: finishedCount <= 0,
    },
    { mode: 'all', label: t('tableRowFilterAll'), count: totalCount },
  ]

  return (
    <div className="tableRowFilterBar">
      <span className="tableRowFilterLabel">{t('tableRowFilterLabel')}</span>
      <div className="tableRowFilterOptions" role="group" aria-label={t('tableRowFilterLabel')}>
        {options.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`tableRowFilterBtn${filterMode === opt.mode ? ' active' : ''}`}
            disabled={opt.disabled}
            aria-pressed={filterMode === opt.mode}
            onClick={() => onFilterModeChange(opt.mode)}
          >
            {opt.label} ({opt.count})
          </button>
        ))}
      </div>
    </div>
  )
}

export function TableWorkspaceHeader({
  editable,
  rowCount,
  finishedCount,
  filterMode,
  onFilterModeChange,
  onAddRow,
}: {
  editable?: boolean
  rowCount: number
  finishedCount: number
  filterMode: TableRowFilterMode
  onFilterModeChange: (mode: TableRowFilterMode) => void
  onAddRow?: () => void
}) {
  const activeCount = rowCount - finishedCount
  if (rowCount <= 0 && !editable) return null

  return (
    <div className="tableWorkspaceHeader">
      <TableRowFilterBar
        filterMode={filterMode}
        finishedCount={finishedCount}
        activeCount={activeCount}
        totalCount={rowCount}
        onFilterModeChange={onFilterModeChange}
      />
      <TableRowActions editable={editable} onAddRow={onAddRow} prominent />
    </div>
  )
}

/** @deprecated use TableWorkspaceHeader */
export const TableEditorFooter = TableWorkspaceHeader

/** @deprecated use TableWorkspaceHeader */
export const TableEditorToolbar = TableWorkspaceHeader

export function TableWorkspace({
  rowCount,
  finishedCount,
  filterMode,
  onFilterModeChange,
  onAddRow,
  showHeader = true,
  className,
  ...gridProps
}: Props & {
  rowCount: number
  finishedCount: number
  filterMode: TableRowFilterMode
  onFilterModeChange: (mode: TableRowFilterMode) => void
  onAddRow?: () => void
  showHeader?: boolean
  className?: string
}) {
  const [activeCellColor, setActiveCellColor] = useState<TableColorKey>('none')
  const canPaintCells = gridProps.editable && !!gridProps.onUpdateCellColor

  return (
    <div className={`card tableWorkspaceCard${className ? ` ${className}` : ''}`}>
      {showHeader || canPaintCells ? (
        <div className="tableWorkspaceStickyTools">
          {showHeader ? (
            <TableWorkspaceHeader
              editable={gridProps.editable}
              rowCount={rowCount}
              finishedCount={finishedCount}
              filterMode={filterMode}
              onFilterModeChange={onFilterModeChange}
              onAddRow={onAddRow}
            />
          ) : null}
          {canPaintCells ? (
            <TableCellColorToolbar activeColor={activeCellColor} onActiveColorChange={setActiveCellColor} />
          ) : null}
        </div>
      ) : null}
      <div className="tableWorkspaceBody tableWrap excelTable">
        <TableGridView
          {...gridProps}
          rowFilterMode={filterMode}
          hideColorToolbar
          activeCellColor={activeCellColor}
          onActiveCellColorChange={setActiveCellColor}
        />
      </div>
    </div>
  )
}

function WaliVisibleHeaderContent({
  rows,
  editable,
  onSetAllWaliVisible,
}: {
  rows: Record<string, unknown>[]
  editable: boolean
  onSetAllWaliVisible?: (visible: boolean) => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLInputElement>(null)
  const allVisible = rows.length > 0 && rows.every((r) => r._wali_visible !== false)
  const someVisible = rows.some((r) => r._wali_visible !== false)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someVisible && !allVisible
  }, [allVisible, someVisible])

  if (editable && onSetAllWaliVisible) {
    return (
      <label className="tableWaliVisibleHeader" title={t('waliVisible')}>
        <input
          ref={ref}
          type="checkbox"
          checked={allVisible}
          aria-label={t('waliVisible')}
          onChange={(e) => onSetAllWaliVisible(e.target.checked)}
        />
        <span className="tableWaliVisibleAbbr">{t('waliVisibleShort')}</span>
      </label>
    )
  }
  return <span className="tableWaliVisibleAbbr">{t('waliVisibleShort')}</span>
}



export function TableGridView({

  columns,

  rows,

  layoutJson,

  tableMeta,

  editable = false,

  showRowMeta = false,

  onUpdateRow,

  onSetAllWaliVisible,

  onUpdateCellColor,

  onDeleteRow,

  showFinishedRows,

  rowFilterMode: rowFilterModeProp,

  hideColorToolbar = false,

  activeCellColor: activeCellColorProp,

  onActiveCellColorChange,

}: Props) {

  const { t, i18n } = useTranslation()

  const locale = i18n.language

  const rowFilterMode = rowFilterModeProp ?? (showFinishedRows ? 'all' : 'active')

  const mergeKeys = tableMeta?.merge_column_keys || []

  const rowEntries = filterTableRowEntries(rows, rowFilterMode)

  const visibleRows = rowEntries.map((e) => e.row)

  const header = buildHeaderModel(columns, layoutJson, locale)

  const spanMap = computeRowSpanMap(visibleRows, mergeKeys)

  const displayCols = header.columnRow.length ? header.columnRow : columns.map((c) => ({ key: c.key, label: colLabel(c, locale) }))

  const showFooter = columnsHaveFooter(columns)

  const canPaintCells = editable && !!onUpdateCellColor

  const canDeleteRows = editable && !!onDeleteRow && rows.length > 1

  const [internalCellColor, setInternalCellColor] = useState<TableColorKey>('none')

  const activeCellColor = activeCellColorProp ?? internalCellColor

  const setActiveCellColor = onActiveCellColorChange ?? setInternalCellColor

  let footerLabelPlaced = false



  function applyCellPaint(rowIdx: number, colKey: string, e: MouseEvent) {

    if (!canPaintCells) return

    if ((e.target as HTMLElement).closest('input,select,textarea,button')) return

    const color = activeCellColor === 'none' ? null : activeCellColor

    onUpdateCellColor!(rowIdx, colKey, color)

  }



  const metaHeaderCells = showRowMeta ? (

    <>

      <th className="tableWaliVisibleCol">
        <WaliVisibleHeaderContent rows={rows} editable={editable} onSetAllWaliVisible={onSetAllWaliVisible} />
      </th>

      <th className="tableRowNumCol">#</th>

    </>

  ) : null



  const metaFooterCells = showRowMeta ? (

    <>

      <td />

      <td className="tableFooterLabel" />

    </>

  ) : null

  const showDeleteCol = showRowMeta && !!onDeleteRow

  const deleteMetaHeader = showDeleteCol ? (
    <TableRowDeleteHeader title={t('deleteRow')} />
  ) : null



  return (

    <>

      {canPaintCells && !hideColorToolbar ? (

        <TableCellColorToolbar activeColor={activeCellColor} onActiveColorChange={setActiveCellColor} />

      ) : null}

      <table>

        <thead>

          {header.hasGroupRow ? (

            <tr className="headerGroupRow">

              {showRowMeta ? (

                <>

                  <th rowSpan={2} className="tableWaliVisibleCol">
                    <WaliVisibleHeaderContent rows={rows} editable={editable} onSetAllWaliVisible={onSetAllWaliVisible} />
                  </th>

                  <th rowSpan={2} className="tableRowNumCol">

                    #

                  </th>

                </>

              ) : null}

              {header.groupRow.map((g, i) => (

                <th key={i} colSpan={g.colSpan}>

                  {g.label}

                </th>

              ))}

              {showRowMeta ? (

                <>

                  <th rowSpan={2} className="tableFinishedCol" title={t('rowFinished')}>
                    {t('rowFinishedShort')}
                  </th>

                  {showDeleteCol ? <TableRowDeleteHeader title={t('deleteRow')} rowSpan={2} /> : null}

                </>

              ) : null}

            </tr>

          ) : null}

          <tr>

            {showRowMeta && !header.hasGroupRow ? metaHeaderCells : null}

            {displayCols.map((c) => (

              <th key={c.key}>{c.label}</th>

            ))}

            {showRowMeta && !header.hasGroupRow ? (

              <th className="tableFinishedCol" title={t('rowFinished')}>{t('rowFinishedShort')}</th>

            ) : null}

            {showRowMeta && !header.hasGroupRow && showDeleteCol ? deleteMetaHeader : null}

          </tr>

        </thead>

        <tbody>

          {rowEntries.map(({ row, idx }, visibleIdx) => {

            return (

              <tr key={idx} className={row._row_finished === true ? 'tableRowFinished' : undefined}>

                {showRowMeta ? (

                  <>

                    <td className="tableWaliVisibleCol">
                      <div className="tableWaliVisibleCell">
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
                      </div>
                    </td>

                    <td className="tableRowNumCol">{idx + 1}</td>

                  </>

                ) : null}

                {displayCols.map((dc) => {

                  const col = columns.find((c) => c.key === dc.key)!

                  const span = spanMap[dc.key]?.[visibleIdx]

                  if (span === 0) return null

                  const cellVal =

                    col.type === 'commune_ref'

                      ? row._municipality_name_ar || row[col.key]

                      : row[col.key]

                  const painted = cellColorFor(row, col.key)

                  const cellBg = tableColorBackground(painted)

                  return (

                    <td

                      key={dc.key}

                      rowSpan={span && span > 1 ? span : undefined}

                      className={[

                        span && span > 1 ? 'mergedCell' : '',

                        canPaintCells ? 'tablePaintableCell' : '',

                        cellBg ? 'tableColoredCell' : '',

                      ]

                        .filter(Boolean)

                        .join(' ')}

                      style={cellBg ? { backgroundColor: cellBg } : undefined}

                      onClick={canPaintCells ? (e) => applyCellPaint(idx, col.key, e) : undefined}

                      title={canPaintCells ? t('tableCellColorHint') : undefined}

                    >

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

                              {pickBilingualText(ch.label_ar, ch.label_fr, locale)}

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

                  <td className="tableFinishedCol">

                    <div className="tableFinishedCell">

                      {editable && onUpdateRow ? (

                        <input

                          type="checkbox"

                          checked={row._row_finished === true}

                          title={t('rowFinishedHint')}

                          onChange={(e) => onUpdateRow(idx, '_row_finished', e.target.checked)}

                        />

                      ) : row._row_finished === true ? (

                        '✓'

                      ) : (

                        '—'

                      )}

                    </div>

                  </td>

                ) : null}

                {showDeleteCol ? (
                  <td className="tableRowDeleteCol">
                    <div className="tableRowDeleteCell">
                      {canDeleteRows ? (
                        <TableRowDeleteButton
                          title={t('deleteRow')}
                          onClick={() => onDeleteRow!(idx)}
                        />
                      ) : null}
                    </div>
                  </td>
                ) : null}

              </tr>

            )

          })}

        </tbody>

        {showFooter ? (

          <tfoot>

            <tr className="tableFooterRow">

              {showRowMeta ? metaFooterCells : null}

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

              {showRowMeta ? <td className="tableFinishedCol" /> : null}

              {showDeleteCol ? <td className="tableRowDeleteCol" /> : null}

            </tr>

          </tfoot>

        ) : null}

      </table>

    </>

  )

}


