import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../../api'
import { SchemaColumnsEditor, validateDraftColumns, type DraftSchemaColumn } from '../SchemaColumnsEditor'
import type { EmbeddedTable } from '../../types/embeddedTable'
import { emptyRowsForColumns } from '../../types/embeddedTable'
import { buildSchemaSaveBody, emptySchemaEditorState, type SchemaFormState } from '../../utils/schemaEditorState'
import { hasBilingualText } from '../../utils/bilingual'
import { defaultDraftHeaderGroups, validateDraftHeaderGroups, type DraftHeaderGroup } from '../../utils/schemaHeaderGroups'
import type { Column } from '../../utils/tableLayout'

type Scope = 'rapport_only' | 'save_service'

type Props = {
  token: string
  serviceId: number
  onCreated: (table: EmbeddedTable) => void
  onError: (key: string) => void
  loading: boolean
  setLoading: (v: boolean) => void
}

export function SchemaTableCreatePanel({ token, serviceId, onCreated, onError, loading, setLoading }: Props) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<Scope>('rapport_only')
  const [schemaForm, setSchemaForm] = useState<SchemaFormState>(() => emptySchemaEditorState().schemaForm)
  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(() => emptySchemaEditorState().draftColumns)
  const [draftHeaderGroups, setDraftHeaderGroups] = useState<DraftHeaderGroup[]>(() => defaultDraftHeaderGroups())

  async function handleCreate() {
    const colErr = validateDraftColumns(draftColumns)
    if (colErr) {
      onError(colErr)
      return
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)
    if (groupErr) {
      onError(groupErr)
      return
    }
    if (!hasBilingualText(schemaForm.name_ar, schemaForm.name_fr)) {
      onError('bilingualLabelRequired')
      return
    }

    const body = buildSchemaSaveBody(schemaForm, draftColumns, draftHeaderGroups)
    setLoading(true)
    try {
      if (scope === 'save_service') {
        const res = await api.createOfficeServiceSchema(token, serviceId, body)
        const schema = res.schema
        const columns = (schema.columns_json || body.columns) as Column[]
        onCreated({
          id: crypto.randomUUID(),
          schema_id: schema.id,
          schema_slug: schema.slug,
          schema_name_ar: schema.name_ar,
          schema_name_fr: schema.name_fr,
          columns,
          layout_json: schema.layout_json || body.layout_json || null,
          table_meta: {},
          rows: emptyRowsForColumns(columns, 1),
          rapport_only: false,
        })
      } else {
        const columns = body.columns as Column[]
        onCreated({
          id: crypto.randomUUID(),
          schema_slug: `local-${crypto.randomUUID()}`,
          schema_name_ar: body.name_ar,
          schema_name_fr: body.name_fr,
          columns,
          layout_json: body.layout_json || null,
          table_meta: {},
          rows: emptyRowsForColumns(columns, 1),
          rapport_only: true,
        })
      }
    } catch {
      onError('errorGeneric')
    } finally {
      setLoading(false)
    }
  }

  const scopeOptions: { id: Scope; titleKey: string; hintKey: string; icon: string }[] = [
    { id: 'rapport_only', titleKey: 'schemaTableScopeRapportOnly', hintKey: 'schemaTableScopeRapportOnlyHint', icon: '📄' },
    { id: 'save_service', titleKey: 'schemaTableScopeSaveService', hintKey: 'schemaTableScopeSaveServiceHint', icon: '🔗' },
  ]

  return (
    <div className="schemaTableCreatePanel">
      <div className="schemaScopeSection">
        <p className="schemaScopeLabel">{t('schemaTableScopeLegend')}</p>
        <div className="schemaScopeCards" role="radiogroup" aria-label={t('schemaTableScopeLegend')}>
          {scopeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={scope === opt.id}
              className={`schemaScopeCard${scope === opt.id ? ' schemaScopeCard-active' : ''}`}
              onClick={() => setScope(opt.id)}
            >
              <span className="schemaScopeCardIcon" aria-hidden>
                {opt.icon}
              </span>
              <span className="schemaScopeCardBody">
                <strong>{t(opt.titleKey)}</strong>
                <span className="muted small">{t(opt.hintKey)}</span>
              </span>
              <span className={`schemaScopeCardCheck${scope === opt.id ? ' on' : ''}`} aria-hidden />
            </button>
          ))}
        </div>
        {scope === 'save_service' ? (
          <p className="schemaScopeSyncNote muted small">{t('schemaTableScopeSyncNote')}</p>
        ) : null}
      </div>

      <section className="schemaTableNameSection">
        <h3 className="schemaSectionTitle">{t('schemaTableNameSection')}</h3>
        <div className="schemaMetaGrid">
          <label>
            <span className="fieldLabel">{t('schemaTableNameAr')}</span>
            <input
              value={schemaForm.name_ar}
              onChange={(e) => setSchemaForm({ ...schemaForm, name_ar: e.target.value })}
              placeholder={t('schemaTableNameArPh')}
            />
          </label>
          <label>
            <span className="fieldLabel">{t('schemaTableNameFr')}</span>
            <input
              value={schemaForm.name_fr}
              onChange={(e) => setSchemaForm({ ...schemaForm, name_fr: e.target.value })}
              placeholder={t('schemaTableNameFrPh')}
            />
          </label>
        </div>
      </section>

      <SchemaColumnsEditor
        columns={draftColumns}
        onChange={setDraftColumns}
        headerGroups={draftHeaderGroups}
        onHeaderGroupsChange={setDraftHeaderGroups}
      />

      <div className="modalActions schemaTableCreateActions">
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => handleCreate()}>
          {scope === 'save_service' ? t('createSchemaAndInsert') : t('createTableAndInsert')}
        </button>
      </div>
    </div>
  )
}
