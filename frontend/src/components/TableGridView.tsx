import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

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

import { contentLocale } from '../config/features'
import { pickBilingualText } from '../utils/bilingual'

import {

  cellColorFor,

  tableColorBackground,

  type TableColorKey,

} from '../utils/tableCellColors'
import { filterTableRowEntries, type TableRowFilterMode } from '../utils/tableRowMeta'
import {
  canReorderRowTo,
  visibleRowLineNumberForScope,
  type TableRowReorderScope,
} from '../utils/tableRowReorder'
import { TableScrollShell } from './TableScrollShell'
import {
  columnMinWidthForKey,
  computeTableLayoutPolicy,
  countViewMetaColumns,
} from '../utils/tableLayoutPolicy'

function TableCellTextarea({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`
  }

  useEffect(() => {
    resize()
  }, [value])

  return (
    <textarea
      ref={ref}
      className="tableCellTextarea"
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
    />
  )
}

type Props = {

  columns: Column[]

  rows: Record<string, unknown>[]

  layoutJson?: LayoutJson | null

  tableMeta?: TableMeta

  editable?: boolean

  showRowMeta?: boolean

  /** Wali-visible + finished columns. Defaults to `showRowMeta && editable`. */
  showAdminMeta?: boolean

  onUpdateRow?: (idx: number, key: string, value: unknown) => void

  onSetAllWaliVisible?: (visible: boolean) => void

  onUpdateCellColor?: (rowIdx: number, colKey: string, color: string | null) => void
  onDeleteRow?: (rowIdx: number) => void
  onReorderRows?: (fromIdx: number, toIdx: number) => void
  reorderScope?: TableRowReorderScope
  showFinishedRows?: boolean
  rowFilterMode?: TableRowFilterMode
  onTableMetaChange?: (patch: Partial<TableMeta>) => void

  onMergeToggle?: (colKey: string, checked: boolean) => void

  hideColorToolbar?: boolean
  activeCellColor?: TableColorKey
  onActiveCellColorChange?: (color: TableColorKey) => void
  /** Table embedded in document/fiche (affects layout policy). */
  embedded?: boolean

}



export function TableTitleBlock({

  tableMeta,

  editable,

  onTableMetaChange,

}: Pick<Props, 'tableMeta' | 'editable' | 'onTableMetaChange'>) {

  const { t, i18n } = useTranslation()

  const displayLocale = i18n.language
  const editLocale = contentLocale(i18n.language)

  const title = pickBilingualText(tableMeta?.title_ar, tableMeta?.title_fr, displayLocale)
  const subtitle = pickBilingualText(tableMeta?.subtitle_ar, tableMeta?.subtitle_fr, displayLocale)



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

          value={editLocale === 'fr' ? tableMeta?.title_fr ?? '' : tableMeta?.title_ar ?? ''}

          onChange={(e) =>

            onTableMetaChange?.(editLocale === 'fr' ? { title_fr: e.target.value } : { title_ar: e.target.value })

          }

        />

      </label>

      <label>

        {t('tableSubtitle')}

        <input

          value={editLocale === 'fr' ? tableMeta?.subtitle_fr ?? '' : tableMeta?.subtitle_ar ?? ''}

          onChange={(e) =>

            onTableMetaChange?.(

              editLocale === 'fr' ? { subtitle_fr: e.target.value } : { subtitle_ar: e.target.value },

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

function TableRowDragHandle({
  title,
  active,
  onPointerDown,
}: {
  title: string
  active?: boolean
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className={`tableRowDragHandle${active ? ' tableRowDragHandle--active' : ''}`}
      title={title}
      aria-label={title}
      onPointerDown={onPointerDown}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M9 5h2v2H9V5zm0 6h2v2H9v-2zm0 6h2v2H9v-2zm4-12h2v2h-2V5zm0 6h2v2h-2v-2zm0 6h2v2h-2v-2z"
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
      <p className="muted small tableRowTotalHint">{t('tableRowTotalLines', { count: totalCount })}</p>
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
  showRowFilters = true,
}: {
  editable?: boolean
  rowCount: number
  finishedCount: number
  filterMode: TableRowFilterMode
  onFilterModeChange: (mode: TableRowFilterMode) => void
  onAddRow?: () => void
  showRowFilters?: boolean
}) {
  const activeCount = rowCount - finishedCount
  if (rowCount <= 0 && !editable) return null

  return (
    <div className="tableWorkspaceHeader">
      {editable && showRowFilters ? (
        <TableRowFilterBar
          filterMode={filterMode}
          finishedCount={finishedCount}
          activeCount={activeCount}
          totalCount={rowCount}
          onFilterModeChange={onFilterModeChange}
        />
      ) : null}
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
  showRowFilters = true,
  className,
  reorderScope,
  ...gridProps
}: Props & {
  rowCount: number
  finishedCount: number
  filterMode: TableRowFilterMode
  onFilterModeChange: (mode: TableRowFilterMode) => void
  onAddRow?: () => void
  showHeader?: boolean
  showRowFilters?: boolean
  className?: string
  reorderScope?: TableRowReorderScope
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
              showRowFilters={showRowFilters}
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
          reorderScope={reorderScope}
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

  showRowMeta = true,

  showAdminMeta: showAdminMetaProp,

  onUpdateRow,

  onSetAllWaliVisible,

  onUpdateCellColor,

  onDeleteRow,

  onReorderRows,

  reorderScope = 'table',

  showFinishedRows,

  rowFilterMode: rowFilterModeProp,

  hideColorToolbar = false,

  activeCellColor: activeCellColorProp,

  onActiveCellColorChange,

  embedded = false,

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

  const showLineNumbers = showRowMeta
  const showAdminMeta = showAdminMetaProp ?? (showRowMeta && editable)

  const showDragCol = showRowMeta && editable && !!onReorderRows

  const tbodyRef = useRef<HTMLTableSectionElement>(null)

  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null)

  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)

  const dragFromRef = useRef<number | null>(null)

  function resolveRowIndexFromPointer(clientY: number) {
    const tbody = tbodyRef.current
    if (!tbody) return null
    const trs = [...tbody.querySelectorAll('tr[data-row-idx]')] as HTMLElement[]
    for (const tr of trs) {
      const rect = tr.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) {
        const idx = Number(tr.dataset.rowIdx)
        return Number.isFinite(idx) ? idx : null
      }
    }
    const last = trs[trs.length - 1]
    if (!last) return null
    const idx = Number(last.dataset.rowIdx)
    return Number.isFinite(idx) ? idx : null
  }

  function finishRowDrag() {
    dragFromRef.current = null
    setDragFromIdx(null)
    setDropTargetIdx(null)
  }

  function startRowDrag(e: ReactPointerEvent<HTMLButtonElement>, fromIdx: number) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragFromRef.current = fromIdx
    setDragFromIdx(fromIdx)
    setDropTargetIdx(fromIdx)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  useEffect(() => {
    if (dragFromIdx == null) return

    function onMove(e: PointerEvent) {
      if (dragFromRef.current == null) return
      setDropTargetIdx(resolveRowIndexFromPointer(e.clientY))
    }

    function onUp(e: PointerEvent) {
      if (dragFromRef.current == null) return
      const from = dragFromRef.current
      const to = resolveRowIndexFromPointer(e.clientY) ?? dropTargetIdx
      if (to != null && onReorderRows && canReorderRowTo(rows, from, to, reorderScope)) {
        onReorderRows(from, to)
      }
      finishRowDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragFromIdx, dropTargetIdx, onReorderRows, reorderScope, rows])

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

  const showDeleteCol = showRowMeta && editable && !!onDeleteRow

  const showLeftMeta = showLineNumbers || showAdminMeta || showDragCol

  const layoutLocale = locale === 'fr' ? 'fr' : 'ar'
  const layoutPolicy = computeTableLayoutPolicy({
    columns,
    rows: visibleRows,
    metaColCount: countViewMetaColumns({
      showRowMeta,
      showAdminMeta,
      showDragCol,
      showDeleteCol,
    }),
    embedded,
    locale: layoutLocale,
  })

  function colMinAttrs(key: string): {
    'data-col-min'?: string
    style?: CSSProperties
  } {
    const w = columnMinWidthForKey(layoutPolicy, columns, key)
    if (!w) return {}
    return {
      'data-col-min': String(w),
      style: { minWidth: w, ['--col-min-width' as string]: `${w}px` },
    }
  }

  const dragHintKey = reorderScope === 'commune' ? 'dragRowCommuneHint' : 'dragRowHint'

  const dragHeaderCell = showDragCol ? (
    <th rowSpan={header.hasGroupRow ? 2 : 1} className="tableRowDragCol" title={t(dragHintKey)}>
      ⋮⋮
    </th>
  ) : null

  const deleteMetaHeader = showDeleteCol ? (
    <TableRowDeleteHeader title={t('deleteRow')} />
  ) : null

  const metaHeaderCells = showLeftMeta ? (

    <>

      {dragHeaderCell}

      {showAdminMeta ? (
        <th className="tableWaliVisibleCol">
          <WaliVisibleHeaderContent rows={rows} editable={editable} onSetAllWaliVisible={onSetAllWaliVisible} />
        </th>
      ) : null}

      {showLineNumbers ? <th className="tableRowNumCol">#</th> : null}

    </>

  ) : null



  const metaFooterCells = showLeftMeta ? (

    <>

      {showDragCol ? <td className="tableRowDragCol" /> : null}

      {showAdminMeta ? <td /> : null}

      {showLineNumbers ? <td className="tableFooterLabel" /> : null}

    </>

  ) : null

  return (

    <>

      {canPaintCells && !hideColorToolbar ? (

        <TableCellColorToolbar activeColor={activeCellColor} onActiveColorChange={setActiveCellColor} />

      ) : null}

      <TableScrollShell
        columns={columns}
        rows={visibleRows}
        metaColCount={layoutPolicy.metaColCount}
        embedded={embedded}
        policy={layoutPolicy}
      >

      <table>

        <thead>

          {header.hasGroupRow ? (

            <tr className="headerGroupRow">

              {showLeftMeta ? (

                <>

                  {dragHeaderCell}

                  {showAdminMeta ? (
                    <th rowSpan={2} className="tableWaliVisibleCol">
                      <WaliVisibleHeaderContent rows={rows} editable={editable} onSetAllWaliVisible={onSetAllWaliVisible} />
                    </th>
                  ) : null}

                  {showLineNumbers ? (
                    <th rowSpan={2} className="tableRowNumCol">
                      #
                    </th>
                  ) : null}

                </>

              ) : null}

              {header.groupRow.map((g, i) => (

                <th key={i} colSpan={g.colSpan}>

                  {g.label}

                </th>

              ))}

              {showAdminMeta ? (
                <th rowSpan={2} className="tableFinishedCol" title={t('rowFinished')}>
                  {t('rowFinishedShort')}
                </th>
              ) : null}

              {showDeleteCol ? <TableRowDeleteHeader title={t('deleteRow')} rowSpan={2} /> : null}

            </tr>

          ) : null}

          <tr>

            {showLeftMeta && !header.hasGroupRow ? metaHeaderCells : null}

            {displayCols.map((c) => {
              const minAttrs = colMinAttrs(c.key)
              return (
                <th key={c.key} data-col-min={minAttrs['data-col-min']} style={minAttrs.style}>
                  {c.label}
                </th>
              )
            })}

            {showAdminMeta && !header.hasGroupRow ? (

              <th className="tableFinishedCol" title={t('rowFinished')}>{t('rowFinishedShort')}</th>

            ) : null}

            {!header.hasGroupRow && showDeleteCol ? deleteMetaHeader : null}

          </tr>

        </thead>

        <tbody ref={tbodyRef}>

          {rowEntries.map(({ row, idx }, visibleIdx) => {

            const isDropTarget =
              dragFromIdx != null &&
              dropTargetIdx === idx &&
              dragFromIdx !== idx &&
              canReorderRowTo(rows, dragFromIdx, idx, reorderScope)

            return (

              <tr
                key={idx}
                data-row-idx={idx}
                className={[
                  row._row_finished === true ? 'tableRowFinished' : '',
                  dragFromIdx === idx ? 'tableRowDragging' : '',
                  isDropTarget ? 'tableRowDropTarget' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
              >

                {showLeftMeta ? (

                  <>

                    {showDragCol ? (
                      <td className="tableRowDragCol">
                        <TableRowDragHandle
                          title={t(dragHintKey)}
                          active={dragFromIdx === idx}
                          onPointerDown={(e) => startRowDrag(e, idx)}
                        />
                      </td>
                    ) : null}

                    {showAdminMeta ? (
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
                    ) : null}

                    {showLineNumbers ? (
                      <td className="tableRowNumCol">
                        {visibleRowLineNumberForScope(rowEntries, visibleIdx, reorderScope)}
                      </td>
                    ) : null}

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

                  const minAttrs = colMinAttrs(dc.key)
                  const cellStyle = {
                    ...(minAttrs.style || {}),
                    ...(cellBg ? { backgroundColor: cellBg } : {}),
                  }

                  return (

                    <td

                      key={dc.key}

                      rowSpan={span && span > 1 ? span : undefined}

                      data-col-min={minAttrs['data-col-min']}

                      className={[

                        span && span > 1 ? 'mergedCell' : '',

                        canPaintCells ? 'tablePaintableCell' : '',

                        cellBg ? 'tableColoredCell' : '',

                        col.type === 'text' ? 'tableTextCol' : '',

                      ]

                        .filter(Boolean)

                        .join(' ')}

                      style={Object.keys(cellStyle).length ? cellStyle : undefined}

                      onClick={canPaintCells ? (e) => applyCellPaint(idx, col.key, e) : undefined}

                      title={canPaintCells ? t('tableCellColorHint') : undefined}

                    >

                      {col.type === 'formula' || col.type === 'commune_ref' || col.key === '__commune_name' ? (

                        <span>{col.type === 'commune_ref' || col.key === '__commune_name' ? String(cellVal ?? '') : formatCell(row[col.key], col, locale)}</span>

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

                      ) : editable && onUpdateRow && col.type === 'text' ? (

                        <TableCellTextarea

                          value={String(row[col.key] ?? '')}

                          onChange={(v) => onUpdateRow(idx, col.key, v)}

                        />

                      ) : editable && onUpdateRow ? (

                        <input

                          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}

                          value={(row[col.key] as string | number) ?? ''}

                          onChange={(e) =>

                            onUpdateRow(idx, col.key, col.type === 'number' ? e.target.value : e.target.value)

                          }

                          disabled={col.type === 'formula'}

                        />

                      ) : col.type === 'text' ? (

                        <span className="tableCellTextDisplay">

                          {formatCell(row[col.key], col, locale)}

                        </span>

                      ) : (

                        formatCell(row[col.key], col, locale)

                      )}

                    </td>

                  )

                })}

                {showAdminMeta ? (

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

              {showLeftMeta ? metaFooterCells : null}

              {displayCols.map((dc) => {

                const col = columns.find((c) => c.key === dc.key)!

                const footerVal = computeColumnFooter(rows, col)

                if (footerVal != null) {
                  const minAttrs = colMinAttrs(dc.key)
                  return (
                    <td
                      key={dc.key}
                      className="tableFooterCell tableFooterValue"
                      data-col-min={minAttrs['data-col-min']}
                      style={minAttrs.style}
                    >
                      {formatCell(footerVal, col, locale)}
                    </td>
                  )
                }

                if (!footerLabelPlaced) {
                  footerLabelPlaced = true
                  const minAttrs = colMinAttrs(dc.key)
                  return (
                    <td
                      key={dc.key}
                      className="tableFooterCell tableFooterLabel"
                      data-col-min={minAttrs['data-col-min']}
                      style={minAttrs.style}
                    >
                      {t('tableFooterTotal')}
                    </td>
                  )
                }

                const minAttrsEmpty = colMinAttrs(dc.key)
                return (
                  <td
                    key={dc.key}
                    className="tableFooterCell"
                    data-col-min={minAttrsEmpty['data-col-min']}
                    style={minAttrsEmpty.style}
                  >
                    —
                  </td>
                )

              })}

              {showAdminMeta ? <td className="tableFinishedCol" /> : null}

              {showDeleteCol ? <td className="tableRowDeleteCol" /> : null}

            </tr>

          </tfoot>

        ) : null}

      </table>

      </TableScrollShell>

    </>

  )

}


