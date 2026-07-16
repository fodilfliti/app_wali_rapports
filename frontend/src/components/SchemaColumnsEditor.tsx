import { useState, Fragment, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import {
  buildColumnsPayload,
  defaultDraftColumns,
  FOOTER_AGGREGATES,
  newDraftChoice,
  newDraftColumn,
  nextAvailableColumnKey,
  NUMBER_FORMATS,
  previewColumnKeys,
  schemaColumnTypeGroupsForPicker,
  validateDraftColumns,
} from '../utils/schemaColumns'
import type { DraftChoiceOption, DraftSchemaColumn, SchemaColumnType } from '../utils/schemaColumns'
import {
  buildPreviewLayoutFromDraft,
  columnGroupBoundary,
  columnLabelForDraft,
  newDraftHeaderGroup,
  previewColumnCellClass,
  pruneHeaderGroupsForColumns,
  type DraftHeaderGroup,
} from '../utils/schemaHeaderGroups'
import { ExpandableHelp } from './ExpandableHelp'
import { FORMULA_COMPARISONS, FORMULA_FUNCTIONS, FORMULA_OPERATORS, previewFormulaExample } from '../utils/formulaEngine'
import { buildHeaderModel, columnsHaveFooter, computeColumnFooter, formatCell } from '../utils/tableLayout'

type Props = {
  columns: DraftSchemaColumn[]
  onChange: (next: DraftSchemaColumn[]) => void
  headerGroups?: DraftHeaderGroup[]
  onHeaderGroupsChange?: (next: DraftHeaderGroup[]) => void
  showPreview?: boolean
}

export function SchemaColumnsEditor({
  columns,
  onChange,
  headerGroups = [],
  onHeaderGroupsChange,
  showPreview = true,
}: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'fr' ? 'fr' : 'ar'
  const showHeaderGroups = Boolean(onHeaderGroupsChange)

  function updateCol(uid: string, patch: Partial<DraftSchemaColumn>) {
    onChange(columns.map((c) => (c.uid === uid ? { ...c, ...patch } : c)))
  }

  function patchColumnType(col: DraftSchemaColumn, type: SchemaColumnType): Partial<DraftSchemaColumn> {
    return {
      type,
      format: type === 'number' || type === 'formula' ? col.format : '',
      formula: type === 'formula' ? col.formula : '',
      footer_aggregate: type === 'number' || type === 'formula' ? col.footer_aggregate : '',
      choices:
        type === 'choice'
          ? col.choices?.length
            ? col.choices
            : [newDraftChoice(t('schemaChoiceDefaultAr'), t('schemaChoiceDefaultFr'))]
          : [],
    }
  }

  function updateChoice(colUid: string, choiceUid: string, patch: Partial<DraftChoiceOption>) {
    onChange(
      columns.map((c) => {
        if (c.uid !== colUid) return c
        return {
          ...c,
          choices: (c.choices || []).map((ch) => (ch.uid === choiceUid ? { ...ch, ...patch } : ch)),
        }
      }),
    )
  }

  function addChoice(colUid: string) {
    onChange(
      columns.map((c) => {
        if (c.uid !== colUid) return c
        const n = (c.choices || []).length + 1
        return {
          ...c,
          choices: [...(c.choices || []), newDraftChoice(`${t('schemaChoiceDefaultAr')} ${n}`, `${t('schemaChoiceDefaultFr')} ${n}`)],
        }
      }),
    )
  }

  function removeChoice(colUid: string, choiceUid: string) {
    onChange(
      columns.map((c) => {
        if (c.uid !== colUid) return c
        if ((c.choices || []).length <= 1) return c
        return { ...c, choices: (c.choices || []).filter((ch) => ch.uid !== choiceUid) }
      }),
    )
  }

  function insertFormulaToken(colUid: string, token: string) {
    onChange(
      columns.map((c) => {
        if (c.uid !== colUid) return c
        const base = c.formula.trim()
        const sep = base && !base.endsWith(' ') && !base.endsWith('(') ? ' ' : ''
        return { ...c, formula: base ? `${base}${sep}${token}` : token }
      }),
    )
  }

  function insertFormulaFunction(colUid: string, template: string) {
    const refs = columnKeyPreview.filter((ref) => ref.type === 'number' || ref.type === 'formula')
    const a = refs[0]?.letter || 'A'
    const b = refs[1]?.letter || 'B'
    const filled = template.replace(/\bA\b/g, a).replace(/\bB\b/g, b)
    insertFormulaToken(colUid, filled)
  }

  const columnKeyPreview = previewColumnKeys(columns, lang)

  function addColumn() {
    const key = nextAvailableColumnKey(columns)
    onChange([
      ...columns,
      {
        ...newDraftColumn(`${t('schemaColumn')} ${columns.length + 1}`, `${t('schemaColumn')} ${columns.length + 1}`),
        key,
      },
    ])
  }

  const [dragColIndex, setDragColIndex] = useState<number | null>(null)
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)
  const dragFromRef = useRef<number | null>(null)
  const dropInsertRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef(columns)
  const pointerDragRef = useRef<{ pointerId: number } | null>(null)
  columnsRef.current = columns

  function setDropIndex(insertIndex: number | null) {
    dropInsertRef.current = insertIndex
    setDropInsertIndex(insertIndex)
  }

  function previewDropPosition(fromIndex: number, insertIndex: number): number {
    let target = insertIndex
    if (fromIndex < insertIndex) target -= 1
    return target + 1
  }

  function resolveListInsertIndexFromY(clientY: number, listEl: HTMLElement): number {
    const cards = [...listEl.querySelectorAll('.schemaColumnCard')] as HTMLElement[]
    if (!cards.length) return 0
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) return i
    }
    return cards.length
  }

  function moveColumnToInsert(fromIndex: number, insertIndex: number) {
    const cols = columnsRef.current
    if (fromIndex < 0 || insertIndex < 0) return
    if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) return
    if (fromIndex >= cols.length || insertIndex > cols.length) return
    const next = [...cols]
    const [item] = next.splice(fromIndex, 1)
    let target = insertIndex
    if (fromIndex < insertIndex) target -= 1
    next.splice(target, 0, item)
    onChange(next)
  }

  function finishDrag() {
    dragFromRef.current = null
    pointerDragRef.current = null
    setDropIndex(null)
    setDragColIndex(null)
  }

  function startPointerDrag(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    pointerDragRef.current = { pointerId: e.pointerId }
    dragFromRef.current = index
    setDragColIndex(index)
    setDropIndex(index)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  useEffect(() => {
    if (dragColIndex == null) return

    function updateDropFromPointer(e: PointerEvent) {
      if (!pointerDragRef.current || e.pointerId !== pointerDragRef.current.pointerId) return
      const listEl = listRef.current
      if (!listEl) return
      setDropIndex(resolveListInsertIndexFromY(e.clientY, listEl))
    }

    function endPointerDrag(e: PointerEvent) {
      if (!pointerDragRef.current || e.pointerId !== pointerDragRef.current.pointerId) return
      const from = dragFromRef.current
      if (from == null) {
        finishDrag()
        return
      }
      const listEl = listRef.current
      const insert = listEl
        ? resolveListInsertIndexFromY(e.clientY, listEl)
        : dropInsertRef.current ?? from
      moveColumnToInsert(from, insert)
      finishDrag()
    }

    document.addEventListener('pointermove', updateDropFromPointer)
    document.addEventListener('pointerup', endPointerDrag)
    document.addEventListener('pointercancel', endPointerDrag)
    return () => {
      document.removeEventListener('pointermove', updateDropFromPointer)
      document.removeEventListener('pointerup', endPointerDrag)
      document.removeEventListener('pointercancel', endPointerDrag)
    }
  }, [dragColIndex])

  function removeColumn(uid: string) {
    if (columns.length <= 1) return
    const nextColumns = columns.filter((c) => c.uid !== uid)
    onChange(nextColumns)
    if (onHeaderGroupsChange) {
      onHeaderGroupsChange(pruneHeaderGroupsForColumns(headerGroups, nextColumns))
    }
  }

  function updateGroup(uid: string, patch: Partial<DraftHeaderGroup>) {
    if (!onHeaderGroupsChange) return
    onHeaderGroupsChange(headerGroups.map((g) => (g.uid === uid ? { ...g, ...patch } : g)))
  }

  function toggleGroupColumn(groupUid: string, columnUid: string, checked: boolean) {
    if (!onHeaderGroupsChange) return
    onHeaderGroupsChange(
      headerGroups.map((g) => {
        if (g.uid !== groupUid) return g
        const set = new Set(g.column_uids)
        if (checked) set.add(columnUid)
        else set.delete(columnUid)
        return { ...g, column_uids: [...set] }
      }),
    )
  }

  function addHeaderGroup() {
    onHeaderGroupsChange?.([...headerGroups, newDraftHeaderGroup()])
  }

  function removeHeaderGroup(uid: string) {
    onHeaderGroupsChange?.(headerGroups.filter((g) => g.uid !== uid))
  }

  const validationKey = validateDraftColumns(columns)
  const previewPayload = buildColumnsPayload(columns)
  const previewColumns = previewPayload.map((p) => ({
    key: p.key,
    type: p.type,
    label_ar: p.label_ar,
    label_fr: p.label_fr,
    format: p.format,
    footer_aggregate: p.footer_aggregate,
    merge_vertical_suggested: p.merge_vertical_suggested,
  }))
  const previewSampleRows = [
    Object.fromEntries(previewColumns.map((c, i) => [c.key, c.type === 'number' || c.type === 'formula' ? i + 1 : ''])),
    Object.fromEntries(previewColumns.map((c, i) => [c.key, c.type === 'number' || c.type === 'formula' ? i + 2 : ''])),
    Object.fromEntries(previewColumns.map((c, i) => [c.key, c.type === 'number' || c.type === 'formula' ? i + 3 : ''])),
  ]
  const previewShowFooter = columnsHaveFooter(previewColumns)
  const previewLayout = showHeaderGroups
    ? buildPreviewLayoutFromDraft(columns, headerGroups, previewPayload)
    : null
  const headerModel = buildHeaderModel(previewColumns, previewLayout, lang)
  const previewShowsGroups = Boolean(headerModel.hasGroupRow)

  return (
    <div className="schemaColumnsEditor">
      <div className="schemaSectionHead">
        <h3 className="schemaSectionTitle">{t('schemaColumnsSection')}</h3>
        <p className="muted schemaColumnsHelp">{t('schemaColumnsHelp')}</p>
        <p className="muted small">{t('schemaColumnDragHint')}</p>
      </div>

      <div
        ref={listRef}
        className={`schemaColumnsList${dragColIndex != null ? ' schemaColumnsList-dragging' : ''}`}
      >
        {columns.map((col, index) => {
          const letter = columnKeyPreview[index]?.letter || ''
          const isDragging = dragColIndex === index
          const dropPosition =
            dragColIndex != null && dropInsertIndex != null && isDragging
              ? previewDropPosition(dragColIndex, dropInsertIndex)
              : null

          return (
          <Fragment key={col.uid}>
            {dragColIndex != null && dropInsertIndex === index ? (
              <div className="schemaColumnDropSlot" aria-live="polite">
                <span className="schemaColumnDropSlotLine" />
                <span className="schemaColumnDropSlotLabel">
                  {t('schemaColumnDropAt', { position: index + 1 })}
                </span>
              </div>
            ) : null}
          <div
            className={`schemaColumnCard card${isDragging ? ' schemaColumnCardDragging' : ''}${dragColIndex != null && dropInsertIndex === index + 1 && dragColIndex !== index ? ' schemaColumnCardDropTarget' : ''}`}
          >
            <div className="schemaColumnCardHeader">
              <span
                role="button"
                tabIndex={0}
                className="schemaColumnDragHandle"
                title={t('schemaColumnDrag')}
                aria-label={t('schemaColumnDrag')}
                onPointerDown={(e) => startPointerDrag(e, index)}
              >
                ⠿
              </span>
              <span className="schemaColumnIndex">
                <code className="schemaColumnLetter" title={t('schemaColumnKeyStickyHint', { letter })}>
                  {letter}
                </code>
                {t('schemaColumn')} {index + 1}
                {isDragging && dropPosition != null ? (
                  <span className="schemaColumnDragTargetBadge">
                    {t('schemaColumnDragMove', { letter, position: dropPosition })}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm schemaColumnRemove"
                disabled={columns.length <= 1}
                onClick={() => removeColumn(col.uid)}
                aria-label={t('delete')}
              >
                ×
              </button>
            </div>

            <div className={`schemaColumnGrid${ENABLE_FR_VALUE_INPUTS ? '' : ' schemaColumnGrid--arOnly'}`}>
              <label>
                <span className="fieldLabel">{t('schemaColumnLabelAr')}</span>
                <input
                  value={col.label_ar}
                  onChange={(e) => updateCol(col.uid, { label_ar: e.target.value })}
                  placeholder={t('schemaColumnLabelArPh')}
                />
              </label>
              {ENABLE_FR_VALUE_INPUTS ? (
                <label>
                  <span className="fieldLabel">{t('schemaColumnLabelFr')}</span>
                  <input
                    value={col.label_fr}
                    onChange={(e) => updateCol(col.uid, { label_fr: e.target.value })}
                    placeholder={t('schemaColumnLabelFrPh')}
                  />
                </label>
              ) : null}
              <label className="schemaColumnWide">
                <span className="fieldLabel">{t('schemaColumnType')}</span>
                <select
                  value={col.type}
                  onChange={(e) => {
                    const type = e.target.value as SchemaColumnType
                    updateCol(col.uid, patchColumnType(col, type))
                  }}
                >
                  {schemaColumnTypeGroupsForPicker(col.type).map((group) => (
                    <optgroup key={group.labelKey} label={t(group.labelKey)}>
                      {group.types.map((type) => (
                        <option key={type} value={type}>
                          {t(`schemaColType_${type}`)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {col.type === 'number' || col.type === 'formula' ? (
                <label className="schemaColumnWide schemaColumnFormatField">
                  <span className="fieldLabel">{t('schemaColumnFormat')}</span>
                  <select
                    value={col.format}
                    onChange={(e) => updateCol(col.uid, { format: e.target.value as DraftSchemaColumn['format'] })}
                  >
                    <option value="">{t('schemaFormatPlain')}</option>
                    {NUMBER_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {t(`schemaColFormat_${f}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <ExpandableHelp title={t('schemaHelpColumnType')} className="schemaColTypeHintExpand schemaColumnWide">
                <p className="muted small schemaColTypeHint">{t(`schemaColTypeHint_${col.type}`)}</p>
              </ExpandableHelp>

              {col.type === 'number' ? (
                <label className="schemaColumnWide">
                  <span className="fieldLabel">{t('schemaColumnFooter')}</span>
                  <select
                    value={col.footer_aggregate || ''}
                    onChange={(e) =>
                      updateCol(col.uid, {
                        footer_aggregate: e.target.value as DraftSchemaColumn['footer_aggregate'],
                      })
                    }
                  >
                    <option value="">{t('schemaFooterNone')}</option>
                    {FOOTER_AGGREGATES.map((agg) => (
                      <option key={agg} value={agg}>
                        {t(`schemaFooter_${agg}`)}
                      </option>
                    ))}
                  </select>
                  <ExpandableHelp title={t('schemaHelpFooter')} className="schemaFooterHelpExpand">
                    <p className="muted small">{t('schemaColumnFooterHelp')}</p>
                  </ExpandableHelp>
                </label>
              ) : null}

              {col.type === 'formula' ? (
                <div className="schemaColumnWide schemaFormulaBlock">
                  <label>
                    <span className="fieldLabel">{t('schemaColumnFormula')}</span>
                    <input
                      value={col.formula}
                      onChange={(e) => updateCol(col.uid, { formula: e.target.value })}
                      placeholder={t('schemaColumnFormulaPh')}
                    />
                  </label>
                  <ExpandableHelp title={t('schemaFormulaToolsTitle')}>
                    <div className="schemaFormulaToolbar">
                      <span className="schemaFormulaToolbarLabel">{t('schemaFormulaOperators')}</span>
                      {FORMULA_OPERATORS.map((op) => (
                        <button
                          key={op.symbol}
                          type="button"
                          className="schemaFormulaOpBtn"
                          title={t(op.labelKey)}
                          onClick={() => insertFormulaToken(col.uid, op.symbol)}
                        >
                          <span className="schemaFormulaOpSymbol">{op.symbol}</span>
                          <span className="schemaFormulaOpLabel">{t(`${op.labelKey}Short`)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="schemaFormulaToolbar">
                      <span className="schemaFormulaToolbarLabel">{t('schemaFormulaComparisons')}</span>
                      {FORMULA_COMPARISONS.map((cmp) => (
                        <button
                          key={cmp.symbol}
                          type="button"
                          className="schemaFormulaOpBtn"
                          title={t(cmp.labelKey)}
                          onClick={() => insertFormulaToken(col.uid, cmp.symbol)}
                        >
                          <span className="schemaFormulaOpSymbol">{cmp.symbol}</span>
                          <span className="schemaFormulaOpLabel">{t(`${cmp.labelKey}Short`)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="schemaFormulaToolbar">
                      <span className="schemaFormulaToolbarLabel">{t('schemaFormulaFunctions')}</span>
                      {FORMULA_FUNCTIONS.map((fn) => (
                        <button
                          key={fn.id}
                          type="button"
                          className="schemaFormulaFnBtn"
                          title={t(fn.labelKey)}
                          onClick={() => insertFormulaFunction(col.uid, fn.template)}
                        >
                          <span className="schemaFormulaFnCode">{fn.id}</span>
                          <span className="schemaFormulaFnLabel">{t(`${fn.labelKey}Short`)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="schemaFormulaKeys">
                      {columnKeyPreview
                        .filter((ref) => ref.uid !== col.uid && ref.type !== 'commune_ref')
                        .map((ref) => (
                          <button
                            key={ref.uid}
                            type="button"
                            className="schemaFormulaKeyChip"
                            title={t('schemaFormulaInsertKey')}
                            onClick={() => insertFormulaToken(col.uid, ref.letter)}
                          >
                            <code className="schemaFormulaKeyLetter">{ref.letter}</code>
                            <span className="schemaFormulaKeyLabel">{ref.label || ref.letter}</span>
                          </button>
                        ))}
                      {!columnKeyPreview.filter((ref) => ref.uid !== col.uid && ref.type === 'number').length ? (
                        <span className="muted small">{t('schemaFormulaNoNumberCols')}</span>
                      ) : null}
                    </div>
                    <p className="muted small schemaFormulaExample">
                      {t('schemaColumnFormulaExample', {
                        example:
                          previewFormulaExample(
                            columnKeyPreview.filter((ref) => ref.uid !== col.uid && ref.type !== 'commune_ref'),
                          ) || 'A x B',
                      })}
                    </p>
                  </ExpandableHelp>
                  <ExpandableHelp title={t('schemaFormulaGuideTitle')}>
                    <ul className="schemaFormulaGuideList muted small">
                      <li>{t('schemaFormulaGuideLine1')}</li>
                      <li>{t('schemaFormulaGuideLine2')}</li>
                      <li>{t('schemaFormulaGuideLine3')}</li>
                      <li>{t('schemaFormulaGuideLine4')}</li>
                      <li>{t('schemaFormulaGuideLine5')}</li>
                      <li>{t('schemaFormulaGuideLine6')}</li>
                      <li>{t('schemaFormulaGuideLine7')}</li>
                    </ul>
                  </ExpandableHelp>
                </div>
              ) : null}

              {col.type === 'formula' ? (
                <label className="schemaColumnWide">
                  <span className="fieldLabel">{t('schemaColumnFooter')}</span>
                  <select
                    value={col.footer_aggregate || ''}
                    onChange={(e) =>
                      updateCol(col.uid, {
                        footer_aggregate: e.target.value as DraftSchemaColumn['footer_aggregate'],
                      })
                    }
                  >
                    <option value="">{t('schemaFooterNone')}</option>
                    {FOOTER_AGGREGATES.map((agg) => (
                      <option key={agg} value={agg}>
                        {t(`schemaFooter_${agg}`)}
                      </option>
                    ))}
                  </select>
                  <ExpandableHelp title={t('schemaHelpFooter')} className="schemaFooterHelpExpand">
                    <p className="muted small">{t('schemaColumnFooterHelp')}</p>
                  </ExpandableHelp>
                </label>
              ) : null}

              {col.type === 'choice' ? (
                <div className="schemaColumnWide schemaChoicesBlock">
                  <p className="fieldLabel">{t('schemaChoiceOptions')}</p>
                  <ExpandableHelp title={t('schemaHelpChoiceOptions')}>
                    <p className="muted small">{t('schemaChoiceOptionsHelp')}</p>
                  </ExpandableHelp>
                  {(col.choices || []).map((ch, choiceIndex) => (
                    <div
                      key={ch.uid}
                      className={`schemaChoiceRow${ENABLE_FR_VALUE_INPUTS ? '' : ' schemaChoiceRow--arOnly'}`}
                    >
                      <span className="schemaChoiceIndex">{choiceIndex + 1}.</span>
                      <input
                        value={ch.label_ar}
                        onChange={(e) => updateChoice(col.uid, ch.uid, { label_ar: e.target.value })}
                        placeholder={t('schemaColumnLabelArPh')}
                      />
                      {ENABLE_FR_VALUE_INPUTS ? (
                        <input
                          value={ch.label_fr}
                          onChange={(e) => updateChoice(col.uid, ch.uid, { label_fr: e.target.value })}
                          placeholder={t('schemaColumnLabelFrPh')}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={(col.choices || []).length <= 1}
                        onClick={() => removeChoice(col.uid, ch.uid)}
                        aria-label={t('delete')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => addChoice(col.uid)}>
                    + {t('schemaAddChoice')}
                  </button>
                </div>
              ) : null}

              {col.type !== 'formula' ? (
                <ExpandableHelp title={t('schemaColumnMergeTitle')} className="schemaMergeOption schemaColumnWide">
                  <label className="schemaMergeOptionCheck schemaColumnCheck">
                    <input
                      type="checkbox"
                      checked={col.merge_vertical_suggested}
                      onChange={(e) => updateCol(col.uid, { merge_vertical_suggested: e.target.checked })}
                    />
                    <span>{t('schemaColumnMergeEnable')}</span>
                  </label>
                  <p className="muted small schemaMergeOptionHelp">{t('schemaColumnMergeHelpShort')}</p>
                </ExpandableHelp>
              ) : null}
            </div>
          </div>
          </Fragment>
          )
        })}
        {dragColIndex != null && dropInsertIndex === columns.length ? (
          <div className="schemaColumnDropSlot" aria-live="polite">
            <span className="schemaColumnDropSlotLine" />
            <span className="schemaColumnDropSlotLabel">
              {t('schemaColumnDropAt', { position: columns.length + 1 })}
            </span>
          </div>
        ) : null}
      </div>

      <button type="button" className="btn btn-secondary schemaAddColumnBtn" onClick={addColumn}>
        + {t('schemaAddColumn')}
      </button>

      {validationKey ? <p className="fieldError">{t(validationKey)}</p> : null}

      {showHeaderGroups ? (
        <div className="schemaHeaderGroupsSection">
          <div className="schemaSectionHead">
            <h3 className="schemaSectionTitle">{t('schemaHeaderGroupsSection')}</h3>
            <p className="muted schemaColumnsHelp">{t('schemaHeaderGroupsHelp')}</p>
          </div>

          {headerGroups.length ? (
            <div className="schemaHeaderGroupsList">
              {headerGroups.map((group, groupIndex) => (
                <div key={group.uid} className="schemaColumnCard card schemaHeaderGroupCard">
                  <div className="schemaColumnCardHeader">
                    <span className="schemaColumnIndex">
                      {t('schemaHeaderGroup')} {groupIndex + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm schemaColumnRemove"
                      onClick={() => removeHeaderGroup(group.uid)}
                      aria-label={t('delete')}
                    >
                      ×
                    </button>
                  </div>
                  <div className={`schemaColumnGrid${ENABLE_FR_VALUE_INPUTS ? '' : ' schemaColumnGrid--arOnly'}`}>
                    <label>
                      <span className="fieldLabel">{t('schemaHeaderGroupLabelAr')}</span>
                      <input
                        value={group.label_ar}
                        onChange={(e) => updateGroup(group.uid, { label_ar: e.target.value })}
                        placeholder={t('schemaHeaderGroupLabelArPh')}
                      />
                    </label>
                    {ENABLE_FR_VALUE_INPUTS ? (
                      <label>
                        <span className="fieldLabel">{t('schemaHeaderGroupLabelFr')}</span>
                        <input
                          value={group.label_fr}
                          onChange={(e) => updateGroup(group.uid, { label_fr: e.target.value })}
                          placeholder={t('schemaHeaderGroupLabelFrPh')}
                        />
                      </label>
                    ) : null}
                  </div>
                  <fieldset className="schemaHeaderGroupColumns">
                    <legend>{t('schemaHeaderGroupColumns')}</legend>
                    <div className="schemaHeaderGroupColumnChecks">
                      {(() => {
                        const visible = columns
                          .map((col, colIndex) => ({ col, colIndex }))
                          .filter(({ col }) => {
                            const checkedHere = group.column_uids.includes(col.uid)
                            const takenElsewhere = headerGroups.some(
                              (g) => g.uid !== group.uid && g.column_uids.includes(col.uid),
                            )
                            return checkedHere || !takenElsewhere
                          })
                        if (!visible.length) {
                          return <p className="muted small">{t('schemaHeaderGroupNoColumns')}</p>
                        }
                        return visible.map(({ col, colIndex }) => {
                          const checked = group.column_uids.includes(col.uid)
                          return (
                            <label key={col.uid} className="schemaColumnCheck">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleGroupColumn(group.uid, col.uid, e.target.checked)}
                              />
                              <span>{columnLabelForDraft(col, lang, colIndex, t)}</span>
                            </label>
                          )
                        })
                      })()}
                    </div>
                  </fieldset>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t('schemaHeaderGroupsEmpty')}</p>
          )}

          <button type="button" className="btn btn-secondary schemaAddColumnBtn" onClick={addHeaderGroup}>
            + {t('schemaAddHeaderGroup')}
          </button>
        </div>
      ) : null}

      {showPreview ? (
        <div className="schemaPreview">
          <h3 className="schemaPreviewTitle">{t('schemaPreview')}</h3>
          <p className="muted small">
            {previewShowsGroups ? t('schemaPreviewHintGrouped') : t('schemaPreviewHint')}
          </p>
          <div className="card tableWrap schemaPreviewTable">
            <table>
              <thead>
                {headerModel.hasGroupRow ? (
                  <tr className="headerGroupRow">
                    <th rowSpan={2} className="schemaPreviewIndexCell">
                      #
                    </th>
                    {headerModel.groupRow.map((g, i) => (
                      <th
                        key={`g-${i}`}
                        colSpan={g.colSpan}
                        className={
                          g.placeholder
                            ? 'schemaPreviewGroupEmpty'
                            : 'schemaPreviewGroupHeader'
                        }
                      >
                        {g.label || ''}
                      </th>
                    ))}
                  </tr>
                ) : null}
                <tr>
                  {!headerModel.hasGroupRow ? (
                    <th className="schemaPreviewIndexCell">#</th>
                  ) : null}
                  {headerModel.columnRow.map((col) => {
                    const boundary = showHeaderGroups
                      ? columnGroupBoundary(col.key, columns, headerGroups, previewPayload)
                      : { grouped: false, groupStart: false, groupEnd: false }
                    return (
                      <th key={col.key} className={previewColumnCellClass(boundary)}>
                        {col.label || '—'}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="muted schemaPreviewIndexCell">1</td>
                  {headerModel.columnRow.map((colHead) => {
                    const col = previewColumns.find((c) => c.key === colHead.key)
                    const boundary = showHeaderGroups
                      ? columnGroupBoundary(colHead.key, columns, headerGroups, previewPayload)
                      : { grouped: false, groupStart: false, groupEnd: false }
                    const cellClass = ['muted', 'schemaPreviewCell', previewColumnCellClass(boundary)]
                      .filter(Boolean)
                      .join(' ')
                    if (!col) return <td key={colHead.key} className={cellClass}>—</td>
                    return (
                      <td key={col.key} className={cellClass}>
                        {col.type === 'number' || col.type === 'formula' ? '1' : null}
                        {col.type === 'date' ? 'YYYY-MM-DD' : null}
                        {col.type === 'commune_ref' ? t('schemaPreviewCommune') : null}
                        {col.type === 'text' || col.type === 'choice' ? '…' : null}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="muted schemaPreviewIndexCell">2</td>
                  {headerModel.columnRow.map((colHead) => {
                    const col = previewColumns.find((c) => c.key === colHead.key)
                    const boundary = showHeaderGroups
                      ? columnGroupBoundary(colHead.key, columns, headerGroups, previewPayload)
                      : { grouped: false, groupStart: false, groupEnd: false }
                    const cellClass = ['muted', 'schemaPreviewCell', previewColumnCellClass(boundary)]
                      .filter(Boolean)
                      .join(' ')
                    if (!col) return <td key={colHead.key} className={cellClass}>—</td>
                    return (
                      <td key={col.key} className={cellClass}>
                        {col.type === 'number' || col.type === 'formula' ? '2' : null}
                        {col.type === 'date' ? 'YYYY-MM-DD' : null}
                        {col.type === 'commune_ref' ? t('schemaPreviewCommune') : null}
                        {col.type === 'text' || col.type === 'choice' ? '…' : null}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="muted schemaPreviewIndexCell">3</td>
                  {headerModel.columnRow.map((colHead) => {
                    const col = previewColumns.find((c) => c.key === colHead.key)
                    const boundary = showHeaderGroups
                      ? columnGroupBoundary(colHead.key, columns, headerGroups, previewPayload)
                      : { grouped: false, groupStart: false, groupEnd: false }
                    const cellClass = ['muted', 'schemaPreviewCell', previewColumnCellClass(boundary)]
                      .filter(Boolean)
                      .join(' ')
                    if (!col) return <td key={colHead.key} className={cellClass}>—</td>
                    return (
                      <td key={col.key} className={cellClass}>
                        {col.type === 'number' || col.type === 'formula' ? '3' : null}
                        {col.type === 'date' ? 'YYYY-MM-DD' : null}
                        {col.type === 'commune_ref' ? t('schemaPreviewCommune') : null}
                        {col.type === 'text' || col.type === 'choice' ? '…' : null}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
              {previewShowFooter ? (
                <tfoot>
                  <tr className="tableFooterRow">
                    <td className="tableFooterLabel muted schemaPreviewIndexCell">{t('tableFooterTotal')}</td>
                    {headerModel.columnRow.map((colHead) => {
                      const col = previewColumns.find((c) => c.key === colHead.key)
                      if (!col) return <td key={colHead.key}>—</td>
                      const val = computeColumnFooter(previewSampleRows, col)
                      return (
                        <td key={col.key} className={val != null ? 'tableFooterValue' : 'muted'}>
                          {val != null ? formatCell(val, col, lang) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { defaultDraftColumns, buildColumnsPayload, validateDraftColumns, type DraftSchemaColumn }
