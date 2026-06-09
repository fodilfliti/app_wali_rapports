import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TableGridView, TableMergeToolbar, TableWorkspace, TableTitleBlock } from '../TableGridView'
import type { EmbeddedTable } from '../../types/embeddedTable'
import type { TableMeta } from '../../utils/tableLayout'
import { emptyRowsForColumns } from '../../types/embeddedTable'
import { countFinishedRows, type TableRowFilterMode } from '../../utils/tableRowMeta'

type Props = {
  table: EmbeddedTable
  onSave: (table: EmbeddedTable) => void
  onClose: () => void
}

export function SchemaTableEditModal({ table, onSave, onClose }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(table.rows)
  const [tableMeta, setTableMeta] = useState<TableMeta>(table.table_meta || {})
  const [rowFilterMode, setRowFilterMode] = useState<TableRowFilterMode>('active')

  useEffect(() => {
    setRows(table.rows?.length ? table.rows : emptyRowsForColumns(table.columns))
    setTableMeta(table.table_meta || {})
  }, [table])

  function updateRow(idx: number, key: string, value: unknown) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }

  function updateCellColor(rowIdx: number, colKey: string, color: string | null) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r
        const cellColors = { ...((r._cell_colors as Record<string, string>) || {}) }
        if (!color || color === 'none') delete cellColors[colKey]
        else cellColors[colKey] = color
        return { ...r, _cell_colors: cellColors }
      }),
    )
  }

  function setAllWaliVisible(visible: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, _wali_visible: visible })))
  }

  function addRow() {
    setRows((prev) => [...prev, ...emptyRowsForColumns(table.columns, 1)])
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const mergeKeys = tableMeta.merge_column_keys || []
  const finishedRowCount = countFinishedRows(rows)

  return (
    <div className="modalOverlay schemaTableModalOverlay">
      <div className="modalCard schemaTableModalCard">
        <h2>{t('schemaTableEdit')}</h2>
        <TableTitleBlock tableMeta={tableMeta} editable onTableMetaChange={(patch) => setTableMeta((p) => ({ ...p, ...patch }))} />
        <TableWorkspace
          className="schemaTableModalWorkspace"
          columns={table.columns}
          rows={rows}
          layoutJson={table.layout_json}
          tableMeta={tableMeta}
          editable
          showRowMeta
          onUpdateRow={updateRow}
          onSetAllWaliVisible={setAllWaliVisible}
          onUpdateCellColor={updateCellColor}
          onDeleteRow={removeRow}
          rowCount={rows.length}
          finishedCount={finishedRowCount}
          filterMode={rowFilterMode}
          onFilterModeChange={setRowFilterMode}
          onAddRow={addRow}
        />
        <TableMergeToolbar
          columns={table.columns}
          mergeKeys={mergeKeys}
          editable
          onMergeToggle={(colKey, checked) =>
            setTableMeta((prev) => ({
              ...prev,
              merge_column_keys: checked
                ? [...(prev.merge_column_keys || []), colKey]
                : (prev.merge_column_keys || []).filter((k) => k !== colKey),
            }))
          }
        />
        <div className="modalActions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave({ ...table, rows, table_meta: tableMeta })}
          >
            {t('save')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
