import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { TableSchemaEditorModal } from '../components/TableSchemaEditorModal'
import { ExpandableHelp } from '../components/ExpandableHelp'
import { validateDraftColumns, type DraftSchemaColumn } from '../components/SchemaColumnsEditor'
import { localizedName } from '../utils/schemaColumns'
import {
  buildSchemaSaveBody,
  emptySchemaEditorState,
  loadSchemaEditorState,
  type SchemaFormState,
} from '../utils/schemaEditorState'
import {
  defaultDraftHeaderGroups,
  validateDraftHeaderGroups,
  type DraftHeaderGroup,
} from '../utils/schemaHeaderGroups'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = { token: string }

const CONTENT_KINDS = ['table_grid', 'document_compose', 'commune_list']

export function OfficeServiceConfigPage({ token }: Props) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [schemas, setSchemas] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [rapportTypes, setRapportTypes] = useState<any[]>([])
  const [service, setService] = useState<any>(null)
  const [schemaModal, setSchemaModal] = useState(false)
  const [editingSchemaId, setEditingSchemaId] = useState<number | null>(null)
  const [typeModal, setTypeModal] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [schemaForm, setSchemaForm] = useState<SchemaFormState>({ name_ar: '', name_fr: '' })
  const [draftHeaderGroups, setDraftHeaderGroups] = useState<DraftHeaderGroup[]>(() => defaultDraftHeaderGroups())
  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(() => emptySchemaEditorState().draftColumns)
  const [typeForm, setTypeForm] = useState({
    name_ar: '',
    name_fr: '',
    content_kind: 'table_grid',
    versioning_mode: 'versioned',
    table_schema_slug: '',
  })
  const [dupForm, setDupForm] = useState({ source_schema_id: '' })

  const load = useCallback(async () => {
    if (!sid) return
    try {
      const [schemaRes, typeRes] = await Promise.all([
        api.listOfficeServiceSchemas(token, sid),
        api.listOfficeServiceRapportTypes(token, sid),
      ])
      setSchemas(schemaRes.schemas)
      setTemplates(schemaRes.templates)
      setRapportTypes(typeRes.rapportTypes)
      setService(typeRes.service)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, sid, snack, t])

  useEffect(() => {
    load()
  }, [load])

  const allSchemas = [...schemas, ...templates]

  function closeSchemaModal() {
    setSchemaModal(false)
    setEditingSchemaId(null)
  }

  async function saveSchema() {
    const colErr = validateDraftColumns(draftColumns)
    if (colErr) {
      snack.show(t(colErr), 'error')
      return
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)
    if (groupErr) {
      snack.show(t(groupErr), 'error')
      return
    }
    if (!schemaForm.name_ar.trim() || !schemaForm.name_fr.trim()) {
      snack.show(t('schemaMetaRequired'), 'error')
      return
    }
    const body = buildSchemaSaveBody(schemaForm, draftColumns, draftHeaderGroups)
    try {
      if (editingSchemaId) {
        await api.patchOfficeSchema(token, editingSchemaId, body)
      } else {
        await api.createOfficeServiceSchema(token, sid, body)
      }
      closeSchemaModal()
      load()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  function openSchemaModal() {
    const empty = emptySchemaEditorState()
    setEditingSchemaId(null)
    setSchemaForm(empty.schemaForm)
    setDraftColumns(empty.draftColumns)
    setDraftHeaderGroups(empty.draftHeaderGroups)
    setSchemaModal(true)
  }

  function openEditSchemaModal(schema: any) {
    const loaded = loadSchemaEditorState(schema)
    setEditingSchemaId(Number(schema.id))
    setSchemaForm(loaded.schemaForm)
    setDraftColumns(loaded.draftColumns)
    setDraftHeaderGroups(loaded.draftHeaderGroups)
    setSchemaModal(true)
  }

  async function saveRapportType() {
    if (!typeForm.name_ar.trim() || !typeForm.name_fr.trim()) {
      snack.show(t('schemaMetaRequired'), 'error')
      return
    }
    try {
      await api.createOfficeServiceRapportType(token, sid, {
        name_ar: typeForm.name_ar.trim(),
        name_fr: typeForm.name_fr.trim(),
        content_kind: typeForm.content_kind,
        versioning_mode: typeForm.versioning_mode,
        table_schema_slug: typeForm.content_kind === 'table_grid' ? typeForm.table_schema_slug : undefined,
      })
      setTypeModal(false)
      load()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function duplicateSchema() {
    if (!dupForm.source_schema_id) return
    try {
      await api.duplicateOfficeServiceSchema(token, sid, {
        source_schema_id: Number(dupForm.source_schema_id),
      })
      setDuplicateModal(false)
      load()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const label = service ? localizedName(service, i18n.language) : t('serviceConfig')

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>
          {label} — {t('serviceConfig')}
        </h1>
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>
      <p className="muted">{t('officeConfigHelp')}</p>

      <div className="section">
        <div className="pageHeader row">
          <h2>{t('tableSchemas')}</h2>
          <button type="button" className="btn btn-primary" onClick={openSchemaModal}>
            {t('createSchema')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDuplicateModal(true)}>
            {t('duplicateTemplate')}
          </button>
        </div>
        <p className="muted small">{t('schemaClickToEdit')}</p>
        <div className="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t('rapportTitle')}</th>
                <th>{t('columnsCount')}</th>
              </tr>
            </thead>
            <tbody>
              {schemas.map((s) => (
                <tr key={s.id} className="clickableRow" onClick={() => openEditSchemaModal(s)}>
                  <td>{localizedName(s, i18n.language)}</td>
                  <td>{(s.columns_json || []).length}</td>
                </tr>
              ))}
              {!schemas.length ? (
                <tr>
                  <td colSpan={2} className="muted">
                    {t('noResults')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="pageHeader row">
          <h2>{t('rapportTypes')}</h2>
          <button type="button" className="btn btn-primary" onClick={() => setTypeModal(true)}>
            {t('createRapportType')}
          </button>
        </div>
        <div className="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t('rapportTitle')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {rapportTypes.map((rt) => (
                <tr key={rt.id}>
                  <td>{localizedName(rt, i18n.language)}</td>
                  <td>{t(`contentKind_${rt.content_kind}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {schemaModal ? (
        <TableSchemaEditorModal
          title={editingSchemaId ? t('editSchema') : t('createSchema')}
          hint={t('createSchemaHint')}
          schemaForm={schemaForm}
          onSchemaFormChange={setSchemaForm}
          draftColumns={draftColumns}
          onDraftColumnsChange={setDraftColumns}
          draftHeaderGroups={draftHeaderGroups}
          onDraftHeaderGroupsChange={setDraftHeaderGroups}
          onSave={saveSchema}
          onCancel={closeSchemaModal}
        />
      ) : null}

      {duplicateModal ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('duplicateTemplate')}</h2>
            <p className="muted">{t('duplicateTemplateHint')}</p>
            <label>
              {t('selectTemplate')}
              <select
                value={dupForm.source_schema_id}
                onChange={(e) => setDupForm({ source_schema_id: e.target.value })}
              >
                <option value="">{t('selectSchema')}</option>
                {templates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localizedName(s, i18n.language)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={duplicateSchema}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDuplicateModal(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {typeModal ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('createRapportType')}</h2>
            <label>
              {t('municipalityNameAr')}
              <input value={typeForm.name_ar} onChange={(e) => setTypeForm({ ...typeForm, name_ar: e.target.value })} />
            </label>
            <label>
              {t('municipalityNameFr')}
              <input value={typeForm.name_fr} onChange={(e) => setTypeForm({ ...typeForm, name_fr: e.target.value })} />
            </label>
            <label>
              {t('contentKind')}
              <select
                value={typeForm.content_kind}
                onChange={(e) => setTypeForm({ ...typeForm, content_kind: e.target.value })}
              >
                {CONTENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`contentKind_${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <ExpandableHelp title={t('schemaHelpContentKind')} className="schemaColTypeHintExpand contentKindHelpExpand">
              <p className="muted small">{t(`contentKindHint_${typeForm.content_kind}`)}</p>
            </ExpandableHelp>
            {typeForm.content_kind === 'table_grid' ? (
              <label>
                {t('linkedSchema')}
                <select
                  value={typeForm.table_schema_slug}
                  onChange={(e) => setTypeForm({ ...typeForm, table_schema_slug: e.target.value })}
                >
                  <option value="">{t('selectSchema')}</option>
                  {allSchemas.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {localizedName(s, i18n.language)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={saveRapportType}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setTypeModal(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
