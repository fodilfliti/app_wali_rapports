import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../../api'
import type { EmbeddedTable } from '../../types/embeddedTable'
import { cloneImportedTableSnapshot, emptyRowsForColumns } from '../../types/embeddedTable'
import { localizedName } from '../../utils/schemaColumns'
import type { Column, LayoutJson } from '../../utils/tableLayout'
import { SchemaTableCreatePanel } from './SchemaTableCreatePanel'
import { formatImportRapportLabel, SchemaTableImportPreview } from './SchemaTableImportPreview'

type Props = {
  token: string
  serviceId: number
  otherServiceIds?: number[]
  onConfirm: (table: EmbeddedTable, opts?: { openEdit?: boolean }) => void
  onClose: () => void
}

type Mode = 'schema' | 'create' | 'import'

type SchemaRow = {
  id?: number
  slug: string
  name_ar: string
  name_fr: string
  columns_json: Column[]
  layout_json?: LayoutJson | null
}

function rapportStatusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    draft: 'statusDraft',
    submitted: 'statusSubmitted',
    under_review: 'statusUnderReview',
    changes_requested: 'statusChangesRequested',
    acknowledged: 'statusAcknowledged',
    archived: 'statusArchived',
  }
  return t(map[status] || 'statusDraft')
}

export function SchemaTablePickModal({ token, serviceId, otherServiceIds = [], onConfirm, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<Mode>('schema')
  const [schemas, setSchemas] = useState<SchemaRow[]>([])
  const [selectedSchemaSlug, setSelectedSchemaSlug] = useState('')
  const [importServiceId, setImportServiceId] = useState(serviceId)
  const [rapports, setRapports] = useState<any[]>([])
  const [importSearch, setImportSearch] = useState('')
  const [selectedRapportId, setSelectedRapportId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceOptions = [serviceId, ...otherServiceIds.filter((id) => id !== serviceId)]

  useEffect(() => {
    api.listOfficeServiceSchemas(token, serviceId).then((r) => {
      const all = [...(r.schemas || []), ...(r.templates || [])] as SchemaRow[]
      setSchemas(all)
      if (all[0]) setSelectedSchemaSlug(all[0].slug)
      else setMode((m) => (m === 'schema' ? 'create' : m))
    })
  }, [token, serviceId])

  useEffect(() => {
    if (mode !== 'import') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      api
        .listOfficeRapports(token, {
          service_id: importServiceId,
          page: 1,
          pageSize: 100,
          content_kind: 'table_grid',
          importable: true,
          search: importSearch,
        })
        .then((r) => {
          if (cancelled) return
          const list = (r.rapports || []).filter((rap) => rap.rapportType?.content_kind === 'table_grid')
          setRapports(list)
          setSelectedRapportId((prev) => (list.some((rap) => String(rap.id) === prev) ? prev : list[0]?.id ? String(list[0].id) : ''))
        })
        .catch(() => {
          if (!cancelled) setError('errorGeneric')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, importSearch ? 300 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, token, importServiceId, importSearch])

  function confirmFromSchema() {
    const schema = schemas.find((s) => s.slug === selectedSchemaSlug)
    if (!schema) return
    const columns = schema.columns_json || []
    onConfirm({
      id: crypto.randomUUID(),
      schema_id: schema.id,
      schema_slug: schema.slug,
      schema_name_ar: schema.name_ar,
      schema_name_fr: schema.name_fr,
      columns,
      layout_json: schema.layout_json || null,
      table_meta: {},
      rows: emptyRowsForColumns(columns, 1),
      rapport_only: false,
    })
  }

  async function confirmFromImport() {
    if (!selectedRapportId) return
    setLoading(true)
    setError(null)
    try {
      const { snapshot } = await api.getRapportTableSnapshot(token, Number(selectedRapportId))
      const table = cloneImportedTableSnapshot(snapshot)
      onConfirm(table, { openEdit: true })
    } catch {
      setError('errorGeneric')
    } finally {
      setLoading(false)
    }
  }

  function handleCreated(table: EmbeddedTable) {
    onConfirm(table, { openEdit: true })
  }

  const wide = mode === 'create' || mode === 'import'

  return (
    <div className="modalOverlay">
      <div className={`modalCard schemaPickModal${wide ? ' wide' : ''}`}>
        <h2>{t('schemaTableInsert')}</h2>
        <div className="schemaPickTabs">
          <button
            type="button"
            className={`btn btn-sm${mode === 'schema' ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => {
              setMode('schema')
              setError(null)
            }}
            disabled={!schemas.length}
          >
            {t('schemaTableFromSchema')}
          </button>
          <button
            type="button"
            className={`btn btn-sm${mode === 'create' ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => {
              setMode('create')
              setError(null)
            }}
          >
            {t('schemaTableCreateNew')}
          </button>
          <button
            type="button"
            className={`btn btn-sm${mode === 'import' ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => {
              setMode('import')
              setError(null)
            }}
          >
            {t('schemaTableFromRapport')}
          </button>
        </div>

        {mode === 'schema' ? (
          schemas.length ? (
            <label>
              {t('selectSchema')}
              <select value={selectedSchemaSlug} onChange={(e) => setSelectedSchemaSlug(e.target.value)}>
                {schemas.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {localizedName(s, i18n.language)} ({(s.columns_json || []).length} {t('columnsCount')})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted small">{t('schemaTableNoSchemasHint')}</p>
          )
        ) : null}

        {mode === 'create' ? (
          <SchemaTableCreatePanel
            token={token}
            serviceId={serviceId}
            loading={loading}
            setLoading={setLoading}
            onError={setError}
            onCreated={handleCreated}
          />
        ) : null}

        {mode === 'import' ? (
          <>
            <p className="muted small">{t('schemaTableImportHint')}</p>
            {serviceOptions.length > 1 ? (
              <label>
                {t('selectService')}
                <select value={importServiceId} onChange={(e) => setImportServiceId(Number(e.target.value))}>
                  {serviceOptions.map((id) => (
                    <option key={id} value={id}>
                      {t('service')} #{id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              {t('searchRapport')}
              <input
                type="search"
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                placeholder={t('searchRapportPlaceholder')}
              />
            </label>
            <label>
              {t('selectRapportToImport')}
              <select value={selectedRapportId} onChange={(e) => setSelectedRapportId(e.target.value)} disabled={loading}>
                <option value="">{t('selectRapportToImport')}</option>
                {rapports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatImportRapportLabel(r, i18n.language, t, rapportStatusLabel(r.status, t))}
                  </option>
                ))}
              </select>
            </label>
            {selectedRapportId ? (
              <SchemaTableImportPreview token={token} rapportId={selectedRapportId} />
            ) : null}
            {!loading && !rapports.length ? <p className="muted small">{t('noTableRapportsFound')}</p> : null}
          </>
        ) : null}

        {error ? <p className="muted small schemaPickError">{t(error)}</p> : null}

        {mode !== 'create' ? (
          <div className="modalActions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || (mode === 'schema' && !selectedSchemaSlug) || (mode === 'import' && !selectedRapportId)}
              onClick={() => (mode === 'schema' ? confirmFromSchema() : confirmFromImport())}
            >
              {mode === 'import' ? t('importAndEdit') : t('insert')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
          </div>
        ) : (
          <div className="modalActions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
