import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../../api'
import type { TableImportSnapshot } from '../../types/embeddedTable'
import { TableGridView, TableTitleBlock } from '../TableGridView'
import { localizedName } from '../../utils/schemaColumns'

const PREVIEW_ROWS = 5

type Props = {
  token: string
  rapportId: string
}

export function SchemaTableImportPreview({ token, rapportId }: Props) {
  const { t, i18n } = useTranslation()
  const [previewTab, setPreviewTab] = useState<'data' | 'schema'>('data')
  const [snapshot, setSnapshot] = useState<TableImportSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!rapportId) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    api
      .getRapportTableSnapshot(token, Number(rapportId))
      .then((res) => {
        if (!cancelled) setSnapshot(res.snapshot)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setSnapshot(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, rapportId])

  if (!rapportId) return null

  if (loading) return <p className="muted small schemaImportPreviewLoading">{t('loading')}</p>
  if (error) return <p className="muted small schemaPickError">{t('importPreviewError')}</p>
  if (!snapshot) return null

  const schemaLabel = snapshot.schema_name_ar
    ? localizedName(
        { name_ar: snapshot.schema_name_ar, name_fr: snapshot.schema_name_fr || snapshot.schema_name_ar },
        i18n.language,
      )
    : snapshot.schema_slug
  const previewRows = (snapshot.rows || []).slice(0, PREVIEW_ROWS)
  const totalRows = snapshot.rows?.length || 0

  return (
    <div className="schemaImportPreview">
      <div className="schemaImportPreviewHeader">
        <div>
          <strong>{t('importPreviewTitle')}</strong>
          <p className="muted small schemaImportPreviewMeta">
            {schemaLabel} · {snapshot.columns.length} {t('columnsCount')} · {totalRows} {t('rows')}
          </p>
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
        <ul className="schemaImportColumnList">
          {snapshot.columns.map((col) => (
            <li key={col.key}>
              <span className="schemaImportColKey">{col.key}</span>
              <span>{localizedName({ name_ar: col.label_ar, name_fr: col.label_fr }, i18n.language)}</span>
              <span className="muted small">({t(`schemaColType_${col.type}` as any, { defaultValue: col.type })})</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <TableTitleBlock tableMeta={snapshot.table_meta || {}} editable={false} />
          <div className="schemaImportPreviewScroll tableWrap excelTable">
            <TableGridView
              columns={snapshot.columns}
              rows={previewRows}
              layoutJson={snapshot.layout_json}
              tableMeta={snapshot.table_meta}
              editable={false}
              showRowMeta
              rowFilterMode="all"
            />
          </div>
          {totalRows > PREVIEW_ROWS ? (
            <p className="muted small schemaImportPreviewMore">
              {t('importPreviewMoreRows', { shown: PREVIEW_ROWS, total: totalRows })}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

export type ImportSummary = {
  schema_name_ar?: string | null
  schema_name_fr?: string | null
  rapport_type_name_ar?: string
  rapport_type_name_fr?: string
  table_title_ar?: string
  table_title_fr?: string
  row_count?: number
  column_count?: number
}

export function formatImportRapportLabel(
  rap: { title?: string; status?: string; import_summary?: ImportSummary },
  lang: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  statusLabel: string,
) {
  const s = rap.import_summary
  if (!s) return `${rap.title || ''} (${statusLabel})`

  const schemaName = s.schema_name_ar
    ? localizedName(
        { name_ar: s.schema_name_ar, name_fr: s.schema_name_fr || s.schema_name_ar },
        lang,
      )
    : ''
  const typeName = s.rapport_type_name_ar
    ? localizedName(
        { name_ar: s.rapport_type_name_ar, name_fr: s.rapport_type_name_fr || s.rapport_type_name_ar },
        lang,
      )
    : ''
  const tableTitle = s.table_title_ar
    ? localizedName({ name_ar: s.table_title_ar, name_fr: s.table_title_fr || s.table_title_ar }, lang)
    : ''

  const primary = schemaName || typeName || tableTitle || rap.title || ''
  const secondary = [typeName, tableTitle].filter((x, i, arr) => x && x !== primary && arr.indexOf(x) === i).join(' · ')
  const stats = `${s.column_count || 0} ${t('columnsCount')} · ${s.row_count || 0} ${t('rows')}`

  const line = [primary, secondary].filter(Boolean).join(' — ')
  return `${line} (${stats}, ${statusLabel})`
}
