import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmActionModal } from './ConfirmActionModal'
import { TableGridView } from './TableGridView'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { bilingualPairForSave, hasBilingualText } from '../utils/bilingual'
import { localizedName } from '../utils/schemaColumns'
import { emptyRowsForColumns } from '../types/embeddedTable'
import type { Column, LayoutJson } from '../utils/tableLayout'
import { useSnackbar } from '../snackbar/SnackbarContext'
import './richText/richText.css'

export type SchemaBrowserRow = {
  id: number
  slug: string
  name_ar?: string
  name_fr?: string
  columns_json?: Column[]
  layout_json?: LayoutJson | null
  is_system?: boolean
  can_delete?: boolean
  service_id?: number | null
  _source?: 'owned' | 'template'
}

type Props = {
  schemas: SchemaBrowserRow[]
  templates?: SchemaBrowserRow[]
  includeTemplates?: boolean
  onEditColumns?: (schema: SchemaBrowserRow) => void
  onSaveNames?: (
    schemaId: number,
    names: { name_ar: string; name_fr: string },
  ) => void | Promise<void>
  onDelete?: (schemaId: number) => void | Promise<void>
}

export function SchemaListPanel({
  schemas,
  templates = [],
  includeTemplates = false,
  onEditColumns,
  onSaveNames,
  onDelete,
}: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [previewTab, setPreviewTab] = useState<'data' | 'schema'>('data')
  const [nameAr, setNameAr] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SchemaBrowserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const rows = useMemo(() => {
    const owned = schemas.map((s) => ({ ...s, _source: 'owned' as const }))
    const temps = includeTemplates
      ? templates.map((s) => ({ ...s, _source: 'template' as const, can_delete: false }))
      : []
    return [...owned, ...temps]
  }, [schemas, templates, includeTemplates])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((s) => {
      const name = localizedName(s, i18n.language).toLowerCase()
      const slug = (s.slug || '').toLowerCase()
      return (
        name.includes(needle) ||
        slug.includes(needle) ||
        (s.name_ar || '').toLowerCase().includes(needle) ||
        (s.name_fr || '').toLowerCase().includes(needle)
      )
    })
  }, [rows, q, i18n.language])

  const selected = useMemo(() => {
    if (!selectedKey) return null
    return rows.find((s) => rowKey(s) === selectedKey) || null
  }, [rows, selectedKey])

  useEffect(() => {
    if (selectedKey && !filtered.some((s) => rowKey(s) === selectedKey)) {
      setSelectedKey(filtered[0] ? rowKey(filtered[0]) : '')
    }
  }, [filtered, selectedKey])

  useEffect(() => {
    if (!selected) {
      setNameAr('')
      setNameFr('')
      return
    }
    setNameAr(selected.name_ar || '')
    setNameFr(selected.name_fr || '')
    setPreviewTab('data')
  }, [selected?.id, selected?._source])

  const canEditOwned = Boolean(
    selected && selected._source === 'owned' && !selected.is_system,
  )

  async function saveNames() {
    if (!selected || !onSaveNames || !canEditOwned) return
    if (!hasBilingualText(nameAr, nameFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    const names = bilingualPairForSave(nameAr, nameFr)
    setSavingName(true)
    try {
      await onSaveNames(selected.id, { name_ar: names.ar, name_fr: names.fr })
      snack.show(t('save'), 'success')
    } catch {
      /* parent shows error */
    } finally {
      setSavingName(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(pendingDelete.id)
      setPendingDelete(null)
      if (selectedKey === rowKey(pendingDelete)) setSelectedKey('')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="schemaListPanel schemaPickerPanel">
      <label>
        {t('schemaBrowserSearch')}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('schemaBrowserSearchPh')}
        />
      </label>

      <label>
        {t('selectSchema')}
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          disabled={!filtered.length}
        >
          <option value="">{t('selectSchema')}</option>
          {filtered.map((s) => (
            <option key={rowKey(s)} value={rowKey(s)}>
              {localizedName(s, i18n.language)}
              {s._source === 'template' || s.is_system
                ? ` (${t('schemaBrowserTemplate')})`
                : ''}{' '}
              — {(s.columns_json || []).length} {t('columnsCount')}
            </option>
          ))}
        </select>
      </label>

      {!filtered.length ? <p className="muted small">{t('schemaBrowserEmpty')}</p> : null}

      {selected ? (
        <>
          {canEditOwned && onSaveNames ? (
            <div className="schemaPickerNameFields">
              <label>
                {t('schemaTableNameAr')}
                <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </label>
              {ENABLE_FR_VALUE_INPUTS ? (
                <label>
                  {t('schemaTableNameFr')}
                  <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
                </label>
              ) : null}
            </div>
          ) : (
            <p className="muted small schemaImportPreviewMeta">
              {localizedName(selected, i18n.language)} · {(selected.columns_json || []).length}{' '}
              {t('columnsCount')}
              {selected._source === 'template' || selected.is_system
                ? ` · ${t('schemaBrowserTemplate')}`
                : null}
            </p>
          )}

          <div className="schemaImportPreview">
            <div className="schemaImportPreviewHeader">
              <div>
                <strong>{t('schemaPreview')}</strong>
                <p className="muted small schemaImportPreviewMeta">{t('schemaPreviewHint')}</p>
              </div>
              <div className="schemaPickTabs schemaImportPreviewTabs">
                <button
                  type="button"
                  className={`btn btn-sm${previewTab === 'data' ? ' btn-primary' : ' btn-secondary'}`}
                  onClick={() => setPreviewTab('data')}
                >
                  {t('importPreviewData')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm${previewTab === 'schema' ? ' btn-primary' : ' btn-secondary'}`}
                  onClick={() => setPreviewTab('schema')}
                >
                  {t('importPreviewSchema')}
                </button>
              </div>
            </div>
            {previewTab === 'schema' ? (
              (selected.columns_json || []).length ? (
                <ul className="schemaImportColumnList">
                  {(selected.columns_json || []).map((col) => (
                    <li key={col.key}>
                      <span className="schemaImportColKey">{col.key}</span>
                      <span>
                        {localizedName(
                          { name_ar: col.label_ar, name_fr: col.label_fr },
                          i18n.language,
                        )}
                      </span>
                      <span className="muted small">
                        ({t(`schemaColType_${col.type}` as 'schemaColType_text', { defaultValue: col.type })})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t('schemaBrowserNoColumns')}</p>
              )
            ) : (
              <div className="schemaImportPreviewScroll tableWrap excelTable">
                <TableGridView
                  columns={selected.columns_json || []}
                  rows={emptyRowsForColumns(selected.columns_json || [], 3)}
                  layoutJson={selected.layout_json}
                  editable={false}
                  showRowMeta
                  rowFilterMode="all"
                  embedded
                />
              </div>
            )}
          </div>

          <div className="schemaPickerActions modalActions">
            {canEditOwned && onSaveNames ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveNames()}
                disabled={savingName}
              >
                {t('schemaBrowserSaveName')}
              </button>
            ) : null}
            {canEditOwned && onEditColumns ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onEditColumns(selected)}
              >
                {t('schemaBrowserEditColumns')}
              </button>
            ) : null}
            {canEditOwned && selected.can_delete && onDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setPendingDelete(selected)}
              >
                {t('deleteUnusedSchema')}
              </button>
            ) : canEditOwned && !selected.can_delete ? (
              <span className="muted small">{t('schemaBrowserInUse')}</span>
            ) : null}
          </div>
        </>
      ) : null}

      <ConfirmActionModal
        open={Boolean(pendingDelete)}
        title={t('deleteUnusedSchemaConfirmTitle')}
        message={t('deleteUnusedSchemaConfirmMessage', {
          name: pendingDelete ? localizedName(pendingDelete, i18n.language) : '',
        })}
        confirmLabel={t('deleteUnusedSchema')}
        variant="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}

function rowKey(s: SchemaBrowserRow) {
  return `${s._source || 'owned'}:${s.id}`
}
